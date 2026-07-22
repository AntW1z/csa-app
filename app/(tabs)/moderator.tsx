import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ScrollView, StyleSheet, Switch, Image, Alert } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, onSnapshot, query, where, orderBy, doc, updateDoc,
  addDoc, deleteDoc, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { Post, UserProfile, CarouselItem, LogEntry, UserRole, MembershipTerm, Visibility, PushMessage, Sponsor } from '../../src/types';
import { colors, radius, spacing, shadow, tagStyle } from '../../src/theme';
import { formatEventTimeRange } from '../../src/utils';
import { sendPushToTokens } from '../../src/notifications';

const pad = (n: number) => String(n).padStart(2, '0');
const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type TimeRange = { start: Date | null; end: Date | null; allDay: boolean };

// 7am-11:30pm in 30-minute steps — a scrollable row of fixed slots instead
// of free text, so times stay consistent, sortable, and comparable.
const TIME_SLOTS = Array.from({ length: 34 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return { value: `${pad(h)}:${pad(m)}`, label: new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) };
});

// A calendar range picker (tap a day for a single-day event, tap a second
// day for a multi-day range) plus an optional "advanced" layer for specific
// start/end times — leaving that collapsed makes it an all-day event. Not a
// native picker: @react-native-community/datetimepicker wasn't receiving
// touches reliably in Expo Go, and fixed slots beat freeform typing anyway.
function EventTimeRangeField({ onChange, initial }: { onChange: (range: TimeRange) => void; initial?: TimeRange }) {
  const [expanded, setExpanded] = useState(false);
  const [startDateStr, setStartDateStr] = useState<string | null>(() => (initial?.start ? toDateString(initial.start) : null));
  const [endDateStr, setEndDateStr] = useState<string | null>(() => {
    if (!initial?.start || !initial.end) return null;
    const s = toDateString(initial.start);
    const e = toDateString(initial.end);
    return e !== s ? e : null;
  });
  const [showTimeLayer, setShowTimeLayer] = useState(() => !!initial && !initial.allDay);
  const [startTime, setStartTime] = useState<string | null>(() =>
    initial && !initial.allDay && initial.start ? `${pad(initial.start.getHours())}:${pad(initial.start.getMinutes())}` : null
  );
  const [endTime, setEndTime] = useState<string | null>(() =>
    initial && !initial.allDay && initial.end ? `${pad(initial.end.getHours())}:${pad(initial.end.getMinutes())}` : null
  );

  const effectiveEndDateStr = endDateStr ?? startDateStr;
  const allDay = !startTime && !endTime;
  const sameDay = !!startDateStr && effectiveEndDateStr === startDateStr;

  // On a single-day event, the end time can't be at or before the start
  // time — for a multi-day range any end time is valid, since it's on a
  // later date regardless of the clock time.
  const pickStartTime = (value: string) => {
    setStartTime(value);
    if (sameDay && endTime && endTime <= value) setEndTime(null);
  };

  const composeDateTime = (dStr: string, time: string | null) => {
    const [y, m, d] = dStr.split('-').map(Number);
    if (!time) return new Date(y, m - 1, d, 0, 0, 0, 0);
    const [h, min] = time.split(':').map(Number);
    return new Date(y, m - 1, d, h, min, 0, 0);
  };

  useEffect(() => {
    onChange({
      start: startDateStr ? composeDateTime(startDateStr, startTime) : null,
      end: effectiveEndDateStr ? composeDateTime(effectiveEndDateStr, endTime) : null,
      allDay,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDateStr, endDateStr, startTime, endTime]);

  // Tap once for a single day; tap a later day to extend into a range; tap
  // an earlier day to restart the range from there.
  const pickDay = (day: DateData) => {
    const dStr = day.dateString;
    if (!startDateStr || endDateStr) {
      setStartDateStr(dStr);
      setEndDateStr(null);
    } else if (dStr < startDateStr) {
      setStartDateStr(dStr);
      setEndDateStr(null);
    } else if (dStr === startDateStr) {
      setEndDateStr(null);
    } else {
      setEndDateStr(dStr);
    }
  };

  const markedDates = (() => {
    if (!startDateStr) return {};
    if (!endDateStr) {
      return { [startDateStr]: { startingDay: true, endingDay: true, color: colors.red, textColor: colors.onAccent } };
    }
    const marks: Record<string, { color: string; textColor: string; startingDay: boolean; endingDay: boolean }> = {};
    const cur = new Date(startDateStr + 'T00:00:00');
    const last = new Date(endDateStr + 'T00:00:00');
    while (cur <= last) {
      const dStr = toDateString(cur);
      marks[dStr] = { color: colors.red, textColor: colors.onAccent, startingDay: dStr === startDateStr, endingDay: dStr === endDateStr };
      cur.setDate(cur.getDate() + 1);
    }
    return marks;
  })();

  const summary = startDateStr
    ? formatEventTimeRange(
        composeDateTime(startDateStr, startTime).toISOString(),
        effectiveEndDateStr ? composeDateTime(effectiveEndDateStr, endTime).toISOString() : undefined,
        allDay
      )
    : '';

  const clear = () => {
    setStartDateStr(null); setEndDateStr(null); setStartTime(null); setEndTime(null);
    setShowTimeLayer(false); setExpanded(false);
  };

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Pressable style={styles.input} onPress={() => setExpanded((e) => !e)}>
        <Text style={summary ? styles.dateValue : styles.datePlaceholder}>
          {summary || 'Date (required)'}
        </Text>
      </Pressable>
      {startDateStr ? (
        <Pressable onPress={clear} hitSlop={8}>
          <Text style={styles.clearText}>Clear date</Text>
        </Pressable>
      ) : null}

      {expanded && (
        <View style={styles.calendarWrap}>
          <Calendar
            current={startDateStr ?? undefined}
            onDayPress={pickDay}
            markingType="period"
            markedDates={markedDates}
            theme={{ todayTextColor: colors.red, arrowColor: colors.red, selectedDayBackgroundColor: colors.red }}
          />
          <Text style={styles.hint}>Tap a day for a single-day event, or tap a second day for a range.</Text>

          {!showTimeLayer ? (
            <Pressable style={styles.addTimeBtn} onPress={() => setShowTimeLayer(true)}>
              <Text style={styles.addTimeBtnText}>+ Add specific start/end time (optional — leave off for all-day)</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.timeRowLabel}>Start time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeRow}>
                {TIME_SLOTS.map((slot) => (
                  <Pressable
                    key={slot.value}
                    style={[styles.timeChip, startTime === slot.value && styles.timeChipActive]}
                    onPress={() => pickStartTime(slot.value)}
                  >
                    <Text style={[styles.timeChipText, startTime === slot.value && styles.timeChipTextActive]}>{slot.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.timeRowLabel}>End time{sameDay && startTime ? ' (after start time)' : ''}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeRow}>
                {TIME_SLOTS.map((slot) => {
                  const tooEarly = sameDay && !!startTime && slot.value <= startTime;
                  return (
                    <Pressable
                      key={slot.value}
                      disabled={tooEarly}
                      style={[styles.timeChip, endTime === slot.value && styles.timeChipActive, tooEarly && styles.timeChipDisabled]}
                      onPress={() => setEndTime(slot.value)}
                    >
                      <Text
                        style={[
                          styles.timeChipText,
                          endTime === slot.value && styles.timeChipTextActive,
                          tooEarly && styles.timeChipTextDisabled,
                        ]}
                      >
                        {slot.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable onPress={() => { setShowTimeLayer(false); setStartTime(null); setEndTime(null); }} hitSlop={8}>
                <Text style={styles.clearText}>Remove times (make all-day)</Text>
              </Pressable>
            </>
          )}

          <Pressable style={styles.doneBtn} onPress={() => setExpanded(false)}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// This route is reachable by URL for anyone, but the tab is hidden for
// non-moderators (see (tabs)/_layout.tsx). Enforce the real boundary with
// Firestore security rules — see firestore.rules — never trust the UI alone.
export default function ModeratorScreen() {
  const { profile } = useAuth();
  const [pending, setPending] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostFormKey, setNewPostFormKey] = useState(0);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventRange, setEventRange] = useState<TimeRange>({ start: null, end: null, allDay: true });
  const [locationText, setLocationText] = useState('');
  const [visibility, setVisibility] = useState<'everyone' | 'members'>('everyone');
  const [type] = useState<'event' | 'announcement' | 'collab'>('event');
  const [imageUrl, setImageUrl] = useState('');
  const [carousel, setCarousel] = useState<CarouselItem[]>([]);
  const [showCarouselPanel, setShowCarouselPanel] = useState(false);
  const [carouselMode, setCarouselMode] = useState<'image' | 'event'>('image');
  const [carouselImageUrl, setCarouselImageUrl] = useState('');
  const [showPendingPanel, setShowPendingPanel] = useState(false);
  const [showPostsPanel, setShowPostsPanel] = useState(false);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [clearStep, setClearStep] = useState<'idle' | 'choose' | 'confirm'>('idle');
  const [clearTerm, setClearTerm] = useState<'year' | 'semester' | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogsPanel, setShowLogsPanel] = useState(false);
  const [clearLogsStep, setClearLogsStep] = useState<'idle' | 'confirm'>('idle');
  const [managingMember, setManagingMember] = useState<UserProfile | null>(null);
  const [removeMemberStep, setRemoveMemberStep] = useState<'idle' | 'confirm'>('idle');
  const [pushMessages, setPushMessages] = useState<PushMessage[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showNewNotif, setShowNewNotif] = useState(false);
  const [editingNotif, setEditingNotif] = useState<PushMessage | null>(null);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifAudience, setNotifAudience] = useState<Visibility>('everyone');
  const [sendingNotif, setSendingNotif] = useState<PushMessage | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [showSponsorsPanel, setShowSponsorsPanel] = useState(false);
  const [showNewSponsor, setShowNewSponsor] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorImageUrl, setSponsorImageUrl] = useState('');
  const [sponsorDescription, setSponsorDescription] = useState('');
  const [sponsorLink, setSponsorLink] = useState('');

  useEffect(() => {
    // Keyed on uid (not just mounted once) so a sign-out/sign-in cycle
    // tears down and recreates this — a live listener that hits a
    // permission-denied (e.g. from signing out while still mounted here)
    // dies permanently otherwise and never recovers on its own.
    if (!profile) return;
    const q = query(collection(db, 'users'), where('memberRequestStatus', '==', 'pending'));
    return onSnapshot(
      q,
      (snap) => setPending(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => console.warn('pending listener error', err)
    );
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users'), where('role', 'in', ['member', 'moderator', 'admin']));
    return onSnapshot(
      q,
      (snap) => setMembers(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => console.warn('members listener error', err)
    );
  }, [profile?.uid]);

  useEffect(() => {
    return onSnapshot(collection(db, 'posts'), (snap) =>
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)))
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'carouselItems'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => setCarousel(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CarouselItem))));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'sponsors'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setSponsors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sponsor))));
  }, []);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => setPushMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PushMessage))),
      (err) => console.warn('notifications listener error', err)
    );
  }, [profile?.uid]);

  useEffect(() => {
    // Only admins can read the log (see firestore.rules) — moderators can
    // still create entries via logAction below, they just can't browse it.
    if (profile?.role !== 'admin') return;
    const q = query(collection(db, 'logs'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LogEntry))),
      (err) => console.warn('logs listener error', err)
    );
  }, [profile?.role]);

  // Fire-and-forget audit trail — every moderation action writes one of
  // these. Moderators' actions still get logged, only an admin can view it.
  const logAction = (message: string) => {
    if (!profile) return;
    addDoc(collection(db, 'logs'), {
      message,
      actorName: profile.displayName,
      actorUid: profile.uid,
      createdAt: serverTimestamp(),
    });
  };

  // Term is chosen by the moderator/admin here, not by the requester.
  const approve = (u: UserProfile, term: 'year' | 'semester') => {
    updateDoc(doc(db, 'users', u.uid), { role: 'member', memberRequestStatus: 'none', membershipTerm: term });
    logAction(`Approved ${u.displayName} as a ${term === 'year' ? 'Full Year' : 'Semester'} member`);
  };

  const deny = (u: UserProfile) => {
    updateDoc(doc(db, 'users', u.uid), { memberRequestStatus: 'none' });
    logAction(`Denied membership request from ${u.displayName}`);
  };

  const openManageMember = (u: UserProfile) => {
    setManagingMember(u);
    setRemoveMemberStep('idle');
  };

  const closeManageMember = () => {
    setManagingMember(null);
    setRemoveMemberStep('idle');
  };

  const changeRole = (u: UserProfile, newRole: UserRole) => {
    updateDoc(doc(db, 'users', u.uid), { role: newRole });
    logAction(`Changed ${u.displayName}'s role to ${newRole}`);
    closeManageMember();
  };

  const changeTerm = (u: UserProfile, term: MembershipTerm) => {
    updateDoc(doc(db, 'users', u.uid), { membershipTerm: term });
    logAction(`Set ${u.displayName}'s membership term to ${term === 'year' ? 'Full Year' : 'Semester'}`);
    setManagingMember({ ...u, membershipTerm: term });
  };

  const removeMembership = (u: UserProfile) => {
    updateDoc(doc(db, 'users', u.uid), { role: 'user', memberRequestStatus: 'none', membershipTerm: null });
    logAction(`Removed ${u.displayName}'s membership`);
    closeManageMember();
  };

  const openNewNotif = () => {
    setEditingNotif(null);
    setNotifTitle(''); setNotifBody(''); setNotifAudience('everyone');
    setShowNewNotif(true);
  };

  const openEditNotif = (msg: PushMessage) => {
    setEditingNotif(msg);
    setNotifTitle(msg.title);
    setNotifBody(msg.body);
    setNotifAudience(msg.audience);
    setShowNewNotif(true);
  };

  const closeNewNotif = () => {
    setShowNewNotif(false);
    setEditingNotif(null);
  };

  const canSaveNotif = !!(notifTitle.trim() && notifBody.trim());

  const saveNotifDraft = async () => {
    if (!canSaveNotif || !profile) return;
    const data = { title: notifTitle.trim(), body: notifBody.trim(), audience: notifAudience };
    if (editingNotif) {
      await updateDoc(doc(db, 'notifications', editingNotif.id), data);
      logAction(`Edited draft notification "${notifTitle}"`);
    } else {
      await addDoc(collection(db, 'notifications'), { ...data, status: 'draft', createdBy: profile.uid, createdAt: serverTimestamp() });
      logAction(`Drafted notification "${notifTitle}"`);
    }
    closeNewNotif();
  };

  const deleteNotif = (msg: PushMessage) => {
    deleteDoc(doc(db, 'notifications', msg.id));
    logAction(`Deleted draft notification "${msg.title}"`);
  };

  // Sent from this device via Expo's push service — "everyone" notifies
  // every registered user, "members" skips role === 'user' (people who
  // haven't joined) even if they'd granted notification permission before
  // requesting membership.
  const confirmSendNotif = async () => {
    if (!sendingNotif) return;
    const snap = await getDocs(collection(db, 'users'));
    const tokens = snap.docs
      .map((d) => d.data() as UserProfile)
      .filter((u) => u.pushToken && (sendingNotif.audience === 'everyone' || u.role !== 'user'))
      .map((u) => u.pushToken as string);
    const reached = await sendPushToTokens(tokens, sendingNotif.title, sendingNotif.body);
    await updateDoc(doc(db, 'notifications', sendingNotif.id), { status: 'sent', sentAt: serverTimestamp() });
    logAction(`Sent notification "${sendingNotif.title}" to ${sendingNotif.audience === 'everyone' ? 'everyone' : 'members'} (${reached} device${reached === 1 ? '' : 's'})`);
    setSendingNotif(null);
    if (!reached) {
      Alert.alert(
        'Sent to 0 devices',
        'No one has push notifications registered yet. This usually means the app isn’t linked to an EAS project (run `eas login` and `eas init`), or no one has granted notification permission on a build that supports it.'
      );
    } else {
      Alert.alert('Sent', `Delivered to ${reached} device${reached === 1 ? '' : 's'}.`);
    }
  };

  const openNewSponsor = () => {
    setEditingSponsor(null);
    setSponsorName(''); setSponsorImageUrl(''); setSponsorDescription(''); setSponsorLink('');
    setShowNewSponsor(true);
  };

  const openEditSponsor = (s: Sponsor) => {
    setEditingSponsor(s);
    setSponsorName(s.name);
    setSponsorImageUrl(s.imageUrl);
    setSponsorDescription(s.description ?? '');
    setSponsorLink(s.link ?? '');
    setShowNewSponsor(true);
  };

  const closeNewSponsor = () => {
    setShowNewSponsor(false);
    setEditingSponsor(null);
  };

  const canSaveSponsor = !!(sponsorName.trim() && sponsorImageUrl.trim());

  const saveSponsor = async () => {
    if (!canSaveSponsor) return;
    const data = {
      name: sponsorName.trim(),
      imageUrl: sponsorImageUrl.trim(),
      ...(sponsorDescription.trim() ? { description: sponsorDescription.trim() } : {}),
      ...(sponsorLink.trim() ? { link: sponsorLink.trim() } : {}),
    };
    if (editingSponsor) {
      await updateDoc(doc(db, 'sponsors', editingSponsor.id), data);
      logAction(`Edited sponsor "${sponsorName}"`);
    } else {
      await addDoc(collection(db, 'sponsors'), { ...data, createdAt: serverTimestamp() });
      logAction(`Added sponsor "${sponsorName}"`);
    }
    closeNewSponsor();
  };

  const deleteSponsor = (s: Sponsor) => {
    deleteDoc(doc(db, 'sponsors', s.id));
    logAction(`Removed sponsor "${s.name}"`);
  };

  const canPublish = !!(title.trim() && description.trim() && eventRange.start && eventRange.end);

  const openNewPost = () => {
    setEditingPost(null);
    setTitle(''); setDescription(''); setEventRange({ start: null, end: null, allDay: true });
    setLocationText(''); setImageUrl(''); setVisibility('everyone');
    setNewPostFormKey((k) => k + 1);
    setShowNewPost(true);
  };

  const openEditPost = (post: Post) => {
    setEditingPost(post);
    setTitle(post.title);
    setDescription(post.description);
    setLocationText(post.locationText ?? '');
    setImageUrl(post.imageUrl ?? '');
    setVisibility(post.visibility);
    setEventRange({
      start: post.dateTime ? new Date(post.dateTime) : null,
      end: post.endDateTime ? new Date(post.endDateTime) : null,
      allDay: post.allDay ?? true,
    });
    setShowNewPost(true);
  };

  const closeNewPost = () => {
    setShowNewPost(false);
    setEditingPost(null);
  };

  const savePost = async () => {
    if (!canPublish || !profile || !eventRange.start || !eventRange.end) return;
    const data = {
      type, title, description, locationText, visibility,
      dateTime: eventRange.start.toISOString(),
      endDateTime: eventRange.end.toISOString(),
      allDay: eventRange.allDay,
      ...(imageUrl ? { imageUrl } : {}),
    };
    if (editingPost) {
      await updateDoc(doc(db, 'posts', editingPost.id), data);
      logAction(`Edited post "${title}"`);
    } else {
      await addDoc(collection(db, 'posts'), { ...data, createdBy: profile.uid, createdAt: serverTimestamp() });
      logAction(`Created post "${title}"`);
    }
    closeNewPost();
  };

  const deletePost = (post: Post) => {
    deleteDoc(doc(db, 'posts', post.id));
    logAction(`Deleted post "${post.title}"`);
  };

  const addCarouselItem = async () => {
    if (!carouselImageUrl) return;
    await addDoc(collection(db, 'carouselItems'), {
      imageUrl: carouselImageUrl,
      createdAt: serverTimestamp(),
    });
    logAction('Added an image to the home carousel');
    // Stays open (not closed) so the new thumbnail's appearance in the list
    // above confirms it worked, in case you're adding several in a row.
    setCarouselImageUrl('');
  };

  const removeCarouselItem = (item: CarouselItem, description: string) => {
    deleteDoc(doc(db, 'carouselItems', item.id));
    logAction(`Removed "${description}" from the home carousel`);
  };

  // The easy path for moderators who don't want to type a link: pick an
  // existing post and its image + tap-to-open-detail both come along
  // automatically (see Home's handleCarouselPress, which resolves postId).
  const addCarouselFromPost = async (post: Post) => {
    if (!post.imageUrl) return;
    await addDoc(collection(db, 'carouselItems'), {
      imageUrl: post.imageUrl,
      postId: post.id,
      createdAt: serverTimestamp(),
    });
    logAction(`Added event "${post.title}" to the home carousel`);
  };

  // At most one post is featured at a time — starring a new one un-stars
  // whichever one currently holds it, using the already-live `posts` list
  // rather than an extra query.
  const toggleFeatured = async (post: Post) => {
    if (post.featured) {
      await updateDoc(doc(db, 'posts', post.id), { featured: false });
      logAction(`Unfeatured post "${post.title}"`);
      return;
    }
    const prevFeatured = posts.find((p) => p.featured && p.id !== post.id);
    if (prevFeatured) await updateDoc(doc(db, 'posts', prevFeatured.id), { featured: false });
    await updateDoc(doc(db, 'posts', post.id), { featured: true });
    logAction(`Featured post "${post.title}" as the launch popup`);
  };

  // Year clears every member regardless of term (a full academic year ending
  // means everyone's membership lapses); semester only clears members who
  // specifically paid for a semester, leaving full-year members untouched.
  // Scoped to role == 'member' so moderators/admins are never touched.
  const clearAllMembers = async () => {
    const q = query(collection(db, 'users'), where('role', '==', 'member'));
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((d) => updateDoc(doc(db, 'users', d.id), { role: 'user', memberRequestStatus: 'none', membershipTerm: null }))
    );
  };

  const clearSemesterMembers = async () => {
    const q = query(collection(db, 'users'), where('role', '==', 'member'), where('membershipTerm', '==', 'semester'));
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((d) => updateDoc(doc(db, 'users', d.id), { role: 'user', memberRequestStatus: 'none', membershipTerm: null }))
    );
  };

  const startClear = () => setClearStep('choose');
  const pickClearTerm = (term: 'year' | 'semester') => { setClearTerm(term); setClearStep('confirm'); };
  const cancelClear = () => { setClearStep('idle'); setClearTerm(null); };
  const confirmClear = async () => {
    logAction(`Cleared ${clearTerm === 'year' ? 'Year' : 'Semester'} memberships`);
    if (clearTerm === 'semester') await clearSemesterMembers();
    else if (clearTerm === 'year') await clearAllMembers();
    cancelClear();
  };

  // Not logged itself (there'd be nothing left afterward to show it was
  // logged) — admin-only via firestore.rules regardless of this UI check.
  const confirmClearLogs = async () => {
    const snap = await getDocs(collection(db, 'logs'));
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'logs', d.id))));
    setClearLogsStep('idle');
  };

  const yearMemberCount = members.filter((m) => m.role === 'member' && m.membershipTerm === 'year').length;
  const semesterMemberCount = members.filter((m) => m.role === 'member' && m.membershipTerm === 'semester').length;
  const moderatorCount = members.filter((m) => m.role === 'moderator').length;
  const adminCount = members.filter((m) => m.role === 'admin').length;

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable style={styles.memberMgmtCard} onPress={() => setShowPendingPanel(true)}>
          <View style={styles.memberMgmtIcon}>
            <Ionicons name="person-add-outline" size={18} color={colors.red} />
          </View>
          <Text style={styles.memberMgmtText}>Pending members</Text>
          {pending.length > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pending.length} pending</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable style={styles.memberMgmtCard} onPress={() => setShowMembersPanel(true)}>
          <View style={styles.memberMgmtIcon}>
            <Ionicons name="people-outline" size={18} color={colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberMgmtText}>Members</Text>
            <Text style={styles.cardSubtitle}>{members.length} member{members.length === 1 ? '' : 's'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable style={styles.memberMgmtCard} onPress={() => setShowPostsPanel(true)}>
          <View style={styles.memberMgmtIcon}>
            <Ionicons name="newspaper-outline" size={18} color={colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberMgmtText}>Posts</Text>
            <Text style={styles.cardSubtitle}>{posts.length} post{posts.length === 1 ? '' : 's'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable style={styles.memberMgmtCard} onPress={() => setShowCarouselPanel(true)}>
          <View style={styles.memberMgmtIcon}>
            <Ionicons name="albums-outline" size={18} color={colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberMgmtText}>Home carousel</Text>
            <Text style={styles.cardSubtitle}>{carousel.length} image{carousel.length === 1 ? '' : 's'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable style={styles.memberMgmtCard} onPress={() => setShowSponsorsPanel(true)}>
          <View style={styles.memberMgmtIcon}>
            <Ionicons name="storefront-outline" size={18} color={colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberMgmtText}>Sponsors</Text>
            <Text style={styles.cardSubtitle}>{sponsors.length} sponsor{sponsors.length === 1 ? '' : 's'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable style={styles.memberMgmtCard} onPress={() => setShowNotifPanel(true)}>
          <View style={styles.memberMgmtIcon}>
            <Ionicons name="notifications-outline" size={18} color={colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberMgmtText}>Notifications</Text>
            <Text style={styles.cardSubtitle}>
              {pushMessages.filter((m) => m.status === 'draft').length} draft{pushMessages.filter((m) => m.status === 'draft').length === 1 ? '' : 's'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {profile?.role === 'admin' && (
          <Pressable style={styles.memberMgmtCard} onPress={() => setShowLogsPanel(true)}>
            <View style={styles.memberMgmtIcon}>
              <Ionicons name="time-outline" size={18} color={colors.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberMgmtText}>Logs</Text>
              <Text style={styles.cardSubtitle}>{logs.length} entr{logs.length === 1 ? 'y' : 'ies'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </ScrollView>

      {showPostsPanel && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={() => setShowPostsPanel(false)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
                  <Text style={styles.header}>Posts ({posts.length})</Text>
                  <Pressable style={styles.addBtn} onPress={openNewPost}>
                    <Ionicons name="add-circle-outline" size={18} color={colors.red} />
                    <Text style={styles.addBtnText}>New post</Text>
                  </Pressable>
                  <Text style={styles.hint}>Star one post to feature it as the full-screen launch popup on Home.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.postRow}>
                  <Pressable onPress={() => toggleFeatured(item)} hitSlop={8}>
                    <Ionicons name={item.featured ? 'star' : 'star-outline'} size={18} color={item.featured ? colors.amber : colors.textMuted} />
                  </Pressable>
                  <View style={[styles.postTag, { backgroundColor: tagStyle[item.type].bg }]}>
                    <Text style={[styles.postTagText, { color: tagStyle[item.type].text }]}>{item.type}</Text>
                  </View>
                  <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
                  <Pressable onPress={() => openEditPost(item)} hitSlop={8}>
                    <Text style={styles.editText}>edit</Text>
                  </Pressable>
                  <Pressable onPress={() => deletePost(item)} hitSlop={8}>
                    <Text style={styles.deleteText}>delete</Text>
                  </Pressable>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No posts yet.</Text>}
            />
          </View>
        </View>
      )}

      {showCarouselPanel && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={() => setShowCarouselPanel(false)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.header}>Home carousel</Text>
              {carousel.length === 0 && <Text style={styles.empty}>No images in the rotation yet.</Text>}
              {carousel.map((item) => {
                const linkedPost = item.postId ? posts.find((p) => p.id === item.postId) : null;
                return (
                  <View key={item.id} style={styles.carouselRow}>
                    <Image source={{ uri: item.imageUrl }} style={styles.carouselThumb} />
                    <Text style={styles.carouselLink} numberOfLines={1}>
                      {item.postId ? `Event: ${linkedPost?.title ?? '(deleted post)'}` : 'Image'}
                    </Text>
                    <Pressable
                      onPress={() => removeCarouselItem(item, item.postId ? `Event: ${linkedPost?.title ?? 'unknown'}` : 'Image')}
                      hitSlop={8}
                    >
                      <Text style={styles.deleteText}>delete</Text>
                    </Pressable>
                  </View>
                );
              })}

              <View style={styles.modeToggle}>
                <Pressable
                  style={[styles.modeBtn, carouselMode === 'image' && styles.modeBtnActive]}
                  onPress={() => setCarouselMode('image')}
                >
                  <Text style={[styles.modeBtnText, carouselMode === 'image' && styles.modeBtnTextActive]}>Image</Text>
                </Pressable>
                <Pressable
                  style={[styles.modeBtn, carouselMode === 'event' && styles.modeBtnActive]}
                  onPress={() => setCarouselMode('event')}
                >
                  <Text style={[styles.modeBtnText, carouselMode === 'event' && styles.modeBtnTextActive]}>Event</Text>
                </Pressable>
              </View>

              {carouselMode === 'image' ? (
                <>
                  <TextInput style={styles.input} placeholder="Image URL" placeholderTextColor={colors.textMuted} autoCapitalize="none" value={carouselImageUrl} onChangeText={setCarouselImageUrl} />
                  <Pressable style={styles.button} onPress={addCarouselItem}>
                    <Text style={styles.buttonText}>Add to carousel</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.hint}>Tap a post to add its image — tapping it in the carousel will open that event's details.</Text>
                  {posts.filter((p) => p.imageUrl).length === 0 && (
                    <Text style={styles.empty}>No posts with images yet — add an image to a post first, or switch to Image mode.</Text>
                  )}
                  {posts.filter((p) => p.imageUrl).map((post) => (
                    <Pressable key={post.id} style={styles.eventPickRow} onPress={() => addCarouselFromPost(post)}>
                      <Image source={{ uri: post.imageUrl }} style={styles.carouselThumb} />
                      <Text style={styles.eventPickTitle} numberOfLines={1}>{post.title}</Text>
                      <Ionicons name="add-circle-outline" size={20} color={colors.red} />
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {showNewPost && (
        // A plain overlay View, not RN's <Modal> — nesting the native
        // DateTimePicker inside an actual <Modal> breaks its touch handling
        // on iOS (the picker renders but won't respond to input).
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={closeNewPost} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.header}>{editingPost ? 'Edit post' : 'New post'}</Text>
              <TextInput style={styles.input} placeholder="Title (required)" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />
              <TextInput style={styles.input} placeholder="Description (required)" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} multiline />
              <EventTimeRangeField
                key={editingPost?.id ?? `new-${newPostFormKey}`}
                onChange={setEventRange}
                initial={editingPost ? eventRange : undefined}
              />
              <TextInput style={styles.input} placeholder="Location (optional)" placeholderTextColor={colors.textMuted} value={locationText} onChangeText={setLocationText} />
              <TextInput style={styles.input} placeholder="Image URL (optional)" placeholderTextColor={colors.textMuted} autoCapitalize="none" value={imageUrl} onChangeText={setImageUrl} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Members only</Text>
                <Switch
                  value={visibility === 'members'}
                  onValueChange={(v) => setVisibility(v ? 'members' : 'everyone')}
                  trackColor={{ true: colors.red, false: colors.borderStrong }}
                />
              </View>
              <Pressable style={[styles.button, !canPublish && styles.buttonDisabled]} onPress={savePost} disabled={!canPublish}>
                <Text style={styles.buttonText}>{editingPost ? 'Save changes' : 'Publish'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      )}

      {showPendingPanel && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={() => setShowPendingPanel(false)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <ScrollView>
              <Text style={styles.header}>Pending members ({pending.length})</Text>
              {pending.length === 0 && <Text style={styles.empty}>Nothing pending.</Text>}
              {pending.map((u) => (
                <View key={u.uid} style={styles.pendingRow}>
                  <Text style={styles.pendingName}>{u.displayName} · {u.email}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <Pressable style={styles.approveBtn} onPress={() => approve(u, 'year')}>
                      <Text style={styles.approveText}>Approve (Year)</Text>
                    </Pressable>
                    <Pressable style={styles.approveBtn} onPress={() => approve(u, 'semester')}>
                      <Text style={styles.approveText}>Approve (Semester)</Text>
                    </Pressable>
                    <Pressable style={styles.denyBtn} onPress={() => deny(u)}>
                      <Text style={styles.denyText}>Deny</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {showMembersPanel && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable
              style={styles.closeBtn}
              onPress={() => { setShowMembersPanel(false); cancelClear(); closeManageMember(); }}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <ScrollView>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{yearMemberCount}</Text>
                  <Text style={styles.statLabel}>Year</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{semesterMemberCount}</Text>
                  <Text style={styles.statLabel}>Semester</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{moderatorCount}</Text>
                  <Text style={styles.statLabel}>Moderators</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{adminCount}</Text>
                  <Text style={styles.statLabel}>Admins</Text>
                </View>
              </View>

              <Text style={styles.header}>Moderators & admins</Text>
              {members.filter((m) => m.role === 'moderator' || m.role === 'admin').length === 0 && (
                <Text style={styles.empty}>None yet.</Text>
              )}
              {members.filter((m) => m.role === 'moderator' || m.role === 'admin').map((m) => (
                <Pressable
                  key={m.uid}
                  style={styles.memberRow}
                  onPress={() => profile?.role === 'admin' && openManageMember(m)}
                >
                  <Text style={styles.memberName} numberOfLines={1}>{m.displayName} · {m.email}</Text>
                  <View style={styles.roleTag}>
                    <Text style={styles.roleTagText}>{m.role}</Text>
                  </View>
                  {profile?.role === 'admin' && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
                </Pressable>
              ))}

              <Text style={[styles.header, { marginTop: spacing.lg }]}>Members ({members.filter((m) => m.role === 'member').length})</Text>
              {members.filter((m) => m.role === 'member').length === 0 && <Text style={styles.empty}>No members yet.</Text>}
              {members.filter((m) => m.role === 'member').map((m) => (
                <Pressable
                  key={m.uid}
                  style={styles.memberRow}
                  onPress={() => profile?.role === 'admin' && openManageMember(m)}
                >
                  <Text style={styles.memberName} numberOfLines={1}>{m.displayName} · {m.email}</Text>
                  <View style={styles.roleTag}>
                    <Text style={styles.roleTagText}>{m.membershipTerm === 'year' ? 'Year' : m.membershipTerm === 'semester' ? 'Semester' : '—'}</Text>
                  </View>
                  {profile?.role === 'admin' && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
                </Pressable>
              ))}

              {profile?.role === 'admin' && (
                <View style={styles.clearSection}>
                  <Text style={styles.header}>Clear membership</Text>

                  {clearStep === 'idle' && (
                    <Pressable style={styles.resetBtn} onPress={startClear}>
                      <Text style={styles.resetText}>Clear membership</Text>
                    </Pressable>
                  )}

                  {clearStep === 'choose' && (
                    <View style={{ gap: spacing.sm }}>
                      <Text style={styles.clearPrompt}>Clear which members?</Text>
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <Pressable style={styles.clearChoiceBtn} onPress={() => pickClearTerm('semester')}>
                          <Text style={styles.clearChoiceBtnText}>Semester</Text>
                        </Pressable>
                        <Pressable style={styles.clearChoiceBtn} onPress={() => pickClearTerm('year')}>
                          <Text style={styles.clearChoiceBtnText}>Year</Text>
                        </Pressable>
                      </View>
                      <Pressable onPress={cancelClear} hitSlop={8}>
                        <Text style={styles.cancelLink}>Cancel</Text>
                      </Pressable>
                    </View>
                  )}

                  {clearStep === 'confirm' && (
                    <View style={{ gap: spacing.sm }}>
                      <Text style={styles.clearPrompt}>
                        Are you sure you want to clear all{' '}
                        <Text style={styles.clearPromptBold}>{clearTerm === 'year' ? 'Year' : 'Semester'}</Text> members?
                        {clearTerm === 'year' ? ' This clears both Year and Semester members.' : ''} This cannot be undone.
                      </Text>
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <Pressable style={styles.dangerBtn} onPress={confirmClear}>
                          <Text style={styles.dangerBtnText}>Confirm</Text>
                        </Pressable>
                        <Pressable style={styles.cancelBtn} onPress={cancelClear}>
                          <Text style={styles.cancelLink}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {managingMember && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={closeManageMember} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <ScrollView>
              <Text style={styles.header}>{managingMember.displayName}</Text>
              <Text style={[styles.hint, { paddingHorizontal: 0, marginTop: -spacing.sm, marginBottom: spacing.md }]}>
                {managingMember.email}
              </Text>

              {managingMember.role === 'member' && (
                <>
                  <Text style={styles.manageSectionLabel}>Membership term</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                    <Pressable
                      style={[styles.termChoiceBtn, managingMember.membershipTerm === 'year' && styles.termChoiceBtnActive]}
                      onPress={() => changeTerm(managingMember, 'year')}
                    >
                      <Text style={styles.termChoiceBtnText}>Full Year</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.termChoiceBtn, managingMember.membershipTerm === 'semester' && styles.termChoiceBtnActive]}
                      onPress={() => changeTerm(managingMember, 'semester')}
                    >
                      <Text style={styles.termChoiceBtnText}>Semester</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.manageSectionLabel}>Role</Text>
                  <Pressable style={styles.resetBtn} onPress={() => changeRole(managingMember, 'moderator')}>
                    <Text style={styles.resetText}>Promote to moderator</Text>
                  </Pressable>

                  <View style={styles.clearSection}>
                    <Text style={styles.header}>Remove membership</Text>
                    {removeMemberStep === 'idle' ? (
                      <Pressable style={styles.resetBtn} onPress={() => setRemoveMemberStep('confirm')}>
                        <Text style={styles.resetText}>Remove membership</Text>
                      </Pressable>
                    ) : (
                      <View style={{ gap: spacing.sm }}>
                        <Text style={styles.clearPrompt}>
                          Are you sure you want to remove{' '}
                          <Text style={styles.clearPromptBold}>{managingMember.displayName}</Text>'s membership? This cannot be undone.
                        </Text>
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                          <Pressable style={styles.dangerBtn} onPress={() => removeMembership(managingMember)}>
                            <Text style={styles.dangerBtnText}>Confirm</Text>
                          </Pressable>
                          <Pressable style={styles.cancelBtn} onPress={() => setRemoveMemberStep('idle')}>
                            <Text style={styles.cancelLink}>Cancel</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                </>
              )}

              {managingMember.role === 'moderator' && (
                <>
                  <Text style={styles.manageSectionLabel}>Role</Text>
                  <Pressable style={styles.resetBtn} onPress={() => changeRole(managingMember, 'admin')}>
                    <Text style={styles.resetText}>Promote to admin</Text>
                  </Pressable>
                  <Pressable style={[styles.resetBtn, { marginTop: spacing.sm }]} onPress={() => changeRole(managingMember, 'member')}>
                    <Text style={styles.resetText}>Demote to member</Text>
                  </Pressable>
                </>
              )}

              {managingMember.role === 'admin' && (
                <>
                  <Text style={styles.manageSectionLabel}>Role</Text>
                  <Pressable style={styles.resetBtn} onPress={() => changeRole(managingMember, 'moderator')}>
                    <Text style={styles.resetText}>Demote to moderator</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {showSponsorsPanel && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={() => setShowSponsorsPanel(false)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.header}>Sponsors ({sponsors.length})</Text>
              <Pressable style={styles.addBtn} onPress={openNewSponsor}>
                <Ionicons name="add-circle-outline" size={18} color={colors.red} />
                <Text style={styles.addBtnText}>New sponsor</Text>
              </Pressable>
              {sponsors.length === 0 && <Text style={styles.empty}>No sponsors yet.</Text>}
              {sponsors.map((s) => (
                <View key={s.id} style={styles.carouselRow}>
                  <Image source={{ uri: s.imageUrl }} style={styles.carouselThumb} />
                  <Text style={styles.carouselLink} numberOfLines={1}>{s.name}</Text>
                  <Pressable onPress={() => openEditSponsor(s)} hitSlop={8}>
                    <Text style={styles.editText}>edit</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteSponsor(s)} hitSlop={8}>
                    <Text style={styles.deleteText}>delete</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {showNewSponsor && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={closeNewSponsor} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.header}>{editingSponsor ? 'Edit sponsor' : 'New sponsor'}</Text>
              <TextInput style={styles.input} placeholder="Sponsor name (required)" placeholderTextColor={colors.textMuted} value={sponsorName} onChangeText={setSponsorName} />
              <TextInput style={styles.input} placeholder="Image URL (required)" placeholderTextColor={colors.textMuted} autoCapitalize="none" value={sponsorImageUrl} onChangeText={setSponsorImageUrl} />
              <TextInput style={styles.input} placeholder="Description (optional)" placeholderTextColor={colors.textMuted} value={sponsorDescription} onChangeText={setSponsorDescription} multiline />
              <TextInput style={styles.input} placeholder="Link (optional)" placeholderTextColor={colors.textMuted} autoCapitalize="none" value={sponsorLink} onChangeText={setSponsorLink} />
              <Pressable style={[styles.button, !canSaveSponsor && styles.buttonDisabled]} onPress={saveSponsor} disabled={!canSaveSponsor}>
                <Text style={styles.buttonText}>{editingSponsor ? 'Save changes' : 'Add sponsor'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      )}

      {showNotifPanel && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={() => setShowNotifPanel(false)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.header}>Notifications</Text>
              <Pressable style={styles.addBtn} onPress={openNewNotif}>
                <Ionicons name="add-circle-outline" size={18} color={colors.red} />
                <Text style={styles.addBtnText}>New message</Text>
              </Pressable>

              <Text style={[styles.header, { marginTop: spacing.lg }]}>
                Drafts ({pushMessages.filter((m) => m.status === 'draft').length})
              </Text>
              {pushMessages.filter((m) => m.status === 'draft').length === 0 && (
                <Text style={styles.empty}>No drafts yet.</Text>
              )}
              {pushMessages.filter((m) => m.status === 'draft').map((msg) => (
                <View key={msg.id} style={styles.notifRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifTitle} numberOfLines={1}>{msg.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>{msg.body}</Text>
                    <View style={styles.roleTag}>
                      <Text style={styles.roleTagText}>{msg.audience === 'everyone' ? 'Everyone' : 'Members'}</Text>
                    </View>
                  </View>
                  <View style={{ gap: spacing.sm, alignItems: 'flex-end' }}>
                    <Pressable onPress={() => setSendingNotif(msg)} hitSlop={8}>
                      <Text style={styles.sendText}>send</Text>
                    </Pressable>
                    <Pressable onPress={() => openEditNotif(msg)} hitSlop={8}>
                      <Text style={styles.editText}>edit</Text>
                    </Pressable>
                    <Pressable onPress={() => deleteNotif(msg)} hitSlop={8}>
                      <Text style={styles.deleteText}>delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}

              <Text style={[styles.header, { marginTop: spacing.lg }]}>
                Sent ({pushMessages.filter((m) => m.status === 'sent').length})
              </Text>
              {pushMessages.filter((m) => m.status === 'sent').length === 0 && (
                <Text style={styles.empty}>Nothing sent yet.</Text>
              )}
              {pushMessages.filter((m) => m.status === 'sent').map((msg) => (
                <View key={msg.id} style={styles.notifRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifTitle} numberOfLines={1}>{msg.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>{msg.body}</Text>
                    <Text style={styles.logMeta}>
                      {msg.audience === 'everyone' ? 'Everyone' : 'Members'}
                      {msg.sentAt?.toDate ? ` · ${msg.sentAt.toDate().toLocaleString()}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {showNewNotif && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={closeNewNotif} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.header}>{editingNotif ? 'Edit draft' : 'New notification'}</Text>
              <TextInput style={styles.input} placeholder="Title (required)" placeholderTextColor={colors.textMuted} value={notifTitle} onChangeText={setNotifTitle} />
              <TextInput style={styles.input} placeholder="Message (required)" placeholderTextColor={colors.textMuted} value={notifBody} onChangeText={setNotifBody} multiline />
              <View style={styles.modeToggle}>
                <Pressable
                  style={[styles.modeBtn, notifAudience === 'everyone' && styles.modeBtnActive]}
                  onPress={() => setNotifAudience('everyone')}
                >
                  <Text style={[styles.modeBtnText, notifAudience === 'everyone' && styles.modeBtnTextActive]}>Everyone</Text>
                </Pressable>
                <Pressable
                  style={[styles.modeBtn, notifAudience === 'members' && styles.modeBtnActive]}
                  onPress={() => setNotifAudience('members')}
                >
                  <Text style={[styles.modeBtnText, notifAudience === 'members' && styles.modeBtnTextActive]}>Members only</Text>
                </Pressable>
              </View>
              <Pressable style={[styles.button, !canSaveNotif && styles.buttonDisabled]} onPress={saveNotifDraft} disabled={!canSaveNotif}>
                <Text style={styles.buttonText}>{editingNotif ? 'Save changes' : 'Save as draft'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      )}

      {sendingNotif && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={() => setSendingNotif(null)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.header}>Send notification</Text>
            <Text style={styles.clearPrompt}>
              Send <Text style={styles.clearPromptBold}>"{sendingNotif.title}"</Text> to{' '}
              <Text style={styles.clearPromptBold}>{sendingNotif.audience === 'everyone' ? 'everyone' : 'members'}</Text>? This cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable style={styles.dangerBtn} onPress={confirmSendNotif}>
                <Text style={styles.dangerBtnText}>Send now</Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={() => setSendingNotif(null)}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {showLogsPanel && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable
              style={styles.closeBtn}
              onPress={() => { setShowLogsPanel(false); setClearLogsStep('idle'); }}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <ScrollView>
              <Text style={styles.header}>Logs ({logs.length})</Text>
              {logs.length === 0 && <Text style={styles.empty}>Nothing logged yet.</Text>}
              {logs.map((log) => (
                <View key={log.id} style={styles.logRow}>
                  <Text style={styles.logMessage}>{log.message}</Text>
                  <Text style={styles.logMeta}>
                    {log.actorName}
                    {log.createdAt?.toDate ? ` · ${log.createdAt.toDate().toLocaleString()}` : ''}
                  </Text>
                </View>
              ))}

              {profile?.role === 'admin' && logs.length > 0 && (
                <View style={styles.clearSection}>
                  {clearLogsStep === 'idle' ? (
                    <Pressable style={styles.resetBtn} onPress={() => setClearLogsStep('confirm')}>
                      <Text style={styles.resetText}>Clear logs</Text>
                    </Pressable>
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      <Text style={styles.clearPrompt}>
                        Are you sure you want to clear all <Text style={styles.clearPromptBold}>logs</Text>? This cannot be undone.
                      </Text>
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <Pressable style={styles.dangerBtn} onPress={confirmClearLogs}>
                          <Text style={styles.dangerBtnText}>Confirm</Text>
                        </Pressable>
                        <Pressable style={styles.cancelBtn} onPress={() => setClearLogsStep('idle')}>
                          <Text style={styles.cancelLink}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  header: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  empty: { color: colors.textMuted },
  pendingRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadow.card,
  },
  pendingName: { fontSize: 13, color: colors.textPrimary },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  memberName: { flex: 1, fontSize: 13, color: colors.textPrimary },
  roleTag: { backgroundColor: colors.neutralSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  roleTagText: { fontSize: 10, fontWeight: '700', color: colors.neutralSoftText, textTransform: 'uppercase' },
  logRow: {
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  logMessage: { fontSize: 13, color: colors.textPrimary },
  logMeta: { fontSize: 11, color: colors.textMuted },
  approveBtn: { backgroundColor: colors.success, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: spacing.md },
  approveText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  denyBtn: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: spacing.md },
  denyText: { color: colors.dangerText, fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, fontSize: 14, color: colors.textPrimary, justifyContent: 'center' },
  datePlaceholder: { color: colors.textMuted, fontSize: 14 },
  dateValue: { color: colors.textPrimary, fontSize: 14 },
  clearText: { color: colors.red, fontSize: 12, fontWeight: '600', marginTop: -spacing.xs, marginBottom: spacing.sm },
  calendarWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  hint: { fontSize: 11, color: colors.textMuted, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  addTimeBtn: { padding: spacing.sm },
  addTimeBtnText: { fontSize: 12, color: colors.red, fontWeight: '600' },
  timeRow: { gap: spacing.xs, padding: spacing.sm },
  timeChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  timeChipActive: { backgroundColor: colors.red, borderColor: colors.red },
  timeChipDisabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  timeChipText: { fontSize: 13, color: colors.textPrimary },
  timeChipTextActive: { color: colors.onAccent, fontWeight: '700' },
  timeChipTextDisabled: { color: colors.textMuted },
  timeRowLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  doneBtnText: { color: colors.red, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  rowLabel: { fontSize: 14, color: colors.textPrimary },
  button: { backgroundColor: colors.red, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  buttonDisabled: { backgroundColor: colors.borderStrong },
  buttonText: { color: colors.onAccent, fontWeight: '700' },
  resetBtn: { borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  resetText: { color: colors.red, fontWeight: '700' },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  postTag: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  postTagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  postTitle: { flex: 1, fontSize: 13, color: colors.textPrimary },
  editText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  deleteText: { color: colors.red, fontSize: 12, fontWeight: '600' },
  sendText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  notifTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  notifBody: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.xs },
  carouselRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  carouselThumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  carouselLink: { flex: 1, fontSize: 12, color: colors.textSecondary },
  modeToggle: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: colors.red, borderColor: colors.red },
  modeBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  modeBtnTextActive: { color: colors.onAccent },
  eventPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  eventPickTitle: { flex: 1, fontSize: 13, color: colors.textPrimary },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  addBtnText: { color: colors.red, fontWeight: '700', fontSize: 14 },
  memberMgmtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  memberMgmtIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberMgmtText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pendingBadge: { backgroundColor: colors.red, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  pendingBadgeText: { color: colors.onAccent, fontSize: 11, fontWeight: '700' },
  clearSection: { marginTop: spacing.lg, gap: spacing.sm },
  clearPrompt: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  clearPromptBold: { fontWeight: '800' },
  clearChoiceBtn: { flex: 1, backgroundColor: colors.red, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  clearChoiceBtnText: { color: colors.onAccent, fontWeight: '700', fontSize: 13 },
  termChoiceBtn: { flex: 1, backgroundColor: colors.borderStrong, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  termChoiceBtnActive: { backgroundColor: colors.red },
  termChoiceBtnText: { color: colors.onAccent, fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.redSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  statNumber: { fontSize: 18, fontWeight: '800', color: colors.redSoftText },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.redSoftText, textTransform: 'uppercase', marginTop: 2 },
  manageSectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm },
  dangerBtn: { flex: 1, backgroundColor: colors.red, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  dangerBtnText: { color: colors.onAccent, fontWeight: '700', fontSize: 13 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  cancelLink: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, maxHeight: '85%', ...shadow.card },
  closeBtn: { alignSelf: 'flex-end', marginBottom: spacing.xs },
});
