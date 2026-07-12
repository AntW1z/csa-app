import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ScrollView, StyleSheet, Switch, Image } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, onSnapshot, query, where, orderBy, doc, updateDoc,
  addDoc, deleteDoc, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { Post, UserProfile, CarouselItem } from '../../src/types';
import { colors, radius, spacing, shadow, tagStyle } from '../../src/theme';
import { formatEventTimeRange } from '../../src/utils';

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
  const [showAddCarousel, setShowAddCarousel] = useState(false);
  const [carouselImageUrl, setCarouselImageUrl] = useState('');
  const [carouselLink, setCarouselLink] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'), where('memberRequestStatus', '==', 'pending'));
    return onSnapshot(q, (snap) => setPending(snap.docs.map((d) => d.data() as UserProfile)));
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'posts'), (snap) =>
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)))
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'carouselItems'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => setCarousel(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CarouselItem))));
  }, []);

  const approve = (uid: string) =>
    updateDoc(doc(db, 'users', uid), { role: 'member', memberRequestStatus: 'none' });

  const deny = (uid: string) =>
    updateDoc(doc(db, 'users', uid), { memberRequestStatus: 'none' });

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
    } else {
      await addDoc(collection(db, 'posts'), { ...data, createdBy: profile.uid, createdAt: serverTimestamp() });
    }
    closeNewPost();
  };

  const addCarouselItem = async () => {
    if (!carouselImageUrl) return;
    await addDoc(collection(db, 'carouselItems'), {
      imageUrl: carouselImageUrl,
      ...(carouselLink ? { link: carouselLink } : {}),
      createdAt: serverTimestamp(),
    });
    setCarouselImageUrl(''); setCarouselLink('');
    setShowAddCarousel(false);
  };

  const removeCarouselItem = (id: string) => deleteDoc(doc(db, 'carouselItems', id));

  // Admin-only, and scoped to role == 'member' so moderators/admins are
  // never touched by an accidental tap.
  const resetAllMembers = async () => {
    const q = query(collection(db, 'users'), where('role', '==', 'member'));
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((d) => updateDoc(doc(db, 'users', d.id), { role: 'user', memberRequestStatus: 'none' }))
    );
  };

  return (
    <>
      <FlatList
        contentContainerStyle={styles.container}
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ gap: 20 }}>
            <View>
              <Text style={styles.header}>Pending requests</Text>
              {pending.length === 0 && <Text style={styles.empty}>Nothing pending.</Text>}
              {pending.map((u) => (
                <View key={u.uid} style={styles.pendingRow}>
                  <Text style={styles.pendingName}>{u.displayName} · {u.email}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable style={styles.approveBtn} onPress={() => approve(u.uid)}>
                      <Text style={styles.approveText}>Approve</Text>
                    </Pressable>
                    <Pressable style={styles.denyBtn} onPress={() => deny(u.uid)}>
                      <Text style={styles.denyText}>Deny</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            <Pressable style={styles.addBtn} onPress={openNewPost}>
              <Ionicons name="add-circle-outline" size={18} color={colors.red} />
              <Text style={styles.addBtnText}>New post</Text>
            </Pressable>

            <View>
              <Text style={styles.header}>Home carousel</Text>
              {carousel.length === 0 && <Text style={styles.empty}>No images in the rotation yet.</Text>}
              {carousel.map((item) => (
                <View key={item.id} style={styles.carouselRow}>
                  <Image source={{ uri: item.imageUrl }} style={styles.carouselThumb} />
                  <Text style={styles.carouselLink} numberOfLines={1}>{item.link || 'no link'}</Text>
                  <Pressable onPress={() => removeCarouselItem(item.id)} hitSlop={8}>
                    <Text style={styles.deleteText}>delete</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.addBtn} onPress={() => setShowAddCarousel(true)}>
                <Ionicons name="add-circle-outline" size={18} color={colors.red} />
                <Text style={styles.addBtnText}>Add image</Text>
              </Pressable>
            </View>

            {profile?.role === 'admin' && (
              <Pressable style={styles.resetBtn} onPress={resetAllMembers}>
                <Text style={styles.resetText}>Reset all members (year-end)</Text>
              </Pressable>
            )}

            <Text style={styles.header}>All posts</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.postRow}>
            <View style={[styles.postTag, { backgroundColor: tagStyle[item.type].bg }]}>
              <Text style={[styles.postTagText, { color: tagStyle[item.type].text }]}>{item.type}</Text>
            </View>
            <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
            <Pressable onPress={() => openEditPost(item)} hitSlop={8}>
              <Text style={styles.editText}>edit</Text>
            </Pressable>
            <Pressable onPress={() => deleteDoc(doc(db, 'posts', item.id))} hitSlop={8}>
              <Text style={styles.deleteText}>delete</Text>
            </Pressable>
          </View>
        )}
      />

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
              <TextInput style={styles.input} placeholder="Title (required)" value={title} onChangeText={setTitle} />
              <TextInput style={styles.input} placeholder="Description (required)" value={description} onChangeText={setDescription} multiline />
              <EventTimeRangeField
                key={editingPost?.id ?? `new-${newPostFormKey}`}
                onChange={setEventRange}
                initial={editingPost ? eventRange : undefined}
              />
              <TextInput style={styles.input} placeholder="Location (optional)" value={locationText} onChangeText={setLocationText} />
              <TextInput style={styles.input} placeholder="Image URL (optional)" autoCapitalize="none" value={imageUrl} onChangeText={setImageUrl} />
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

      {showAddCarousel && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={() => setShowAddCarousel(false)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.header}>Add to carousel</Text>
            <TextInput style={styles.input} placeholder="Image URL" autoCapitalize="none" value={carouselImageUrl} onChangeText={setCarouselImageUrl} />
            <TextInput style={styles.input} placeholder="Link when tapped (optional, e.g. /calendar)" autoCapitalize="none" value={carouselLink} onChangeText={setCarouselLink} />
            <Pressable style={styles.button} onPress={addCarouselItem}>
              <Text style={styles.buttonText}>Add to carousel</Text>
            </Pressable>
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
  approveBtn: { backgroundColor: colors.success, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: spacing.md },
  approveText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  denyBtn: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: spacing.md },
  denyText: { color: colors.dangerText, fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, fontSize: 14, justifyContent: 'center' },
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
  carouselRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  carouselThumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  carouselLink: { flex: 1, fontSize: 12, color: colors.textSecondary },
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
