import { useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Post, StudentYear } from '../types';
import { colors, radius, spacing, shadow, tagStyle } from '../theme';
import { formatEventTimeRange } from '../utils';
import { YEAR_OPTIONS } from '../constants';

const TAG_LABEL: Record<Post['type'], string> = {
  event: 'event',
  announcement: 'announcement',
  collab: 'collab',
};

// Full detail popup for a post — image, tag, title, time, location,
// description. Shared by PostCard's own tap target and the Home launch
// popup (tapping the ad opens this same view for the featured post).
export default function PostDetailModal({ post, visible, onClose }: { post: Post; visible: boolean; onClose: () => void }) {
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const { firebaseUser, profile, loading } = useAuth();
  const router = useRouter();
  const time = formatEventTimeRange(post.dateTime, post.endDateTime, post.allDay);
  const tag = tagStyle[post.type];

  // Only shown when a moderator actually turned on "Require check-in" for
  // this post (see the New/Edit Post form) — most posts have none and skip
  // check-in entirely rather than showing a button that can never succeed.
  // Not restricted to type === 'event' — that's the main use case (and the
  // only type the form currently creates), but nothing here assumes it, so
  // a check-in-enabled announcement/collab would work the same way if one
  // ever existed.
  const checkInEnabled = !!post.checkInCode;
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [yearDraft, setYearDraft] = useState<StudentYear | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [checkInError, setCheckInError] = useState('');
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);

  const alreadyCheckedIn = !!profile && !!post.checkIns?.some((c) => c.uid === profile.uid);

  const startCheckIn = () => {
    setCheckInError('');
    setCodeInput('');
    setYearDraft(profile?.year ?? null);
    setCheckInOpen(true);
  };

  // One check-in per member, enforced client-side only (no server-side
  // uniqueness check) — acceptable at this club's scale, where the worst
  // case is someone editing local state to claim twice, which just isn't
  // worth guarding against here.
  const submitCheckIn = async () => {
    if (!profile) return;
    const year = profile.year ?? yearDraft;
    if (!year) {
      setCheckInError('Select your year.');
      return;
    }
    // codeInput is already digits-only and capped at 6 chars as typed (see
    // the TextInput below), but re-checking the length here means a
    // mis-set (non-6-digit) checkInCode on the post itself can never match
    // by accident either.
    if (codeInput.length !== 6 || (post.checkInCode ?? '').length !== 6 || codeInput !== post.checkInCode) {
      setCheckInError('Incorrect code.');
      return;
    }
    setSubmittingCheckIn(true);
    setCheckInError('');
    try {
      // Legacy accounts (created before this field existed) fill in their
      // year here as a fallback, since they never got the mandatory
      // post-signup prompt (see profile.tsx) — this is the one other place
      // a missing `year` gets resolved.
      if (!profile.year) {
        await updateDoc(doc(db, 'users', profile.uid), { year });
      }
      await updateDoc(doc(db, 'posts', post.id), {
        // checkedInAt is a client timestamp, not serverTimestamp() —
        // Firestore doesn't support that sentinel inside arrayUnion objects.
        checkIns: arrayUnion({ uid: profile.uid, name: profile.displayName, year, checkedInAt: new Date().toISOString() }),
      });
      setCheckInOpen(false);
    } catch {
      setCheckInError('Something went wrong — try again.');
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  const goSignIn = () => {
    onClose();
    router.push('/profile');
  };

  if (!visible) return null;

  // A plain absolute-positioned overlay, not RN's <Modal> — Modal's
  // transparent presentation intercepts touch handling in ways that broke
  // ScrollView's drag-to-scroll here (long descriptions got stuck
  // un-scrollable), the same class of issue documented on the date picker
  // fields elsewhere in this app. This overlay pattern (used by the
  // Sponsors detail popup and every panel in Manage) scrolls correctly.
  return (
    // Tapping the dimmed backdrop closes the popup; the inner Pressable
    // stops that tap from bubbling up when it lands on the card itself.
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.detailCard} onPress={(e) => e.stopPropagation()}>
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </Pressable>
        <ScrollView>
          {post.imageUrl ? (
            // Full image, not cropped — sized to its real aspect ratio
            // once known so there's no cover-crop or awkward letterboxing.
            // The wrapping View explicitly centers it, since resizeMode
            // "contain" alone doesn't reliably center the rendered box
            // on every platform.
            <View style={styles.detailImageWrap}>
              <Image
                source={{ uri: post.imageUrl }}
                style={[styles.detailImage, imageAspect ? { width: '100%', height: undefined, aspectRatio: imageAspect } : null]}
                resizeMode="contain"
                onLoad={(e) => {
                  // Native (iOS/Android) reports size via nativeEvent.source;
                  // React Native Web reports it via the underlying <img> at
                  // nativeEvent.target instead — read whichever is present.
                  const native = e.nativeEvent as any;
                  const width = native.source?.width ?? native.target?.naturalWidth;
                  const height = native.source?.height ?? native.target?.naturalHeight;
                  if (width && height) setImageAspect(width / height);
                }}
              />
            </View>
          ) : null}
          <View style={styles.detailBody}>
            <View style={[styles.tag, { backgroundColor: tag.bg }]}>
              <Text style={[styles.tagText, { color: tag.text }]}>{TAG_LABEL[post.type]}</Text>
            </View>
            <Text style={styles.detailTitle}>{post.title}</Text>
            {time ? <Text style={styles.meta}>{time}</Text> : null}
            {post.locationText ? <Text style={styles.meta}>{post.locationText}</Text> : null}
            {post.description ? <Text style={styles.description}>{post.description}</Text> : null}

            {checkInEnabled && !loading && (
              <View style={styles.checkInSection}>
                {!firebaseUser ? (
                  <>
                    <Text style={styles.checkInHint}>Sign in to check in to this event.</Text>
                    <Pressable style={styles.checkInBtn} onPress={goSignIn}>
                      <Text style={styles.checkInBtnText}>Sign in</Text>
                    </Pressable>
                  </>
                ) : alreadyCheckedIn ? (
                  <View style={styles.checkedInRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.red} />
                    <Text style={styles.checkedInText}>You're checked in!</Text>
                  </View>
                ) : !checkInOpen ? (
                  <Pressable style={styles.checkInBtn} onPress={startCheckIn}>
                    <Ionicons name="qr-code-outline" size={16} color={colors.onAccent} />
                    <Text style={styles.checkInBtnText}>Check in</Text>
                  </Pressable>
                ) : (
                  <View>
                    {!profile?.year && (
                      <>
                        <Text style={styles.checkInHint}>What year are you?</Text>
                        <View style={styles.yearRow}>
                          {YEAR_OPTIONS.map((y) => (
                            <Pressable
                              key={y}
                              style={[styles.yearChip, yearDraft === y && styles.yearChipActive]}
                              onPress={() => setYearDraft(y)}
                            >
                              <Text style={[styles.yearChipText, yearDraft === y && styles.yearChipTextActive]}>{y}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </>
                    )}
                    <Text style={styles.checkInHint}>Enter the 6-digit code announced at the event:</Text>
                    <TextInput
                      style={styles.checkInInput}
                      placeholder="6-digit code"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={codeInput}
                      // Digits-only whitelist as they type — nothing but
                      // 0-9 ever reaches state here, which is also what
                      // keeps this field safe from injection-style input.
                      onChangeText={(v) => setCodeInput(v.replace(/[^0-9]/g, '').slice(0, 6))}
                    />
                    {checkInError ? <Text style={styles.checkInErrorText}>{checkInError}</Text> : null}
                    <View style={styles.checkInActionRow}>
                      <Pressable style={styles.checkInCancelBtn} onPress={() => setCheckInOpen(false)}>
                        <Text style={styles.checkInCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.checkInBtn,
                          { flex: 1 },
                          (submittingCheckIn || codeInput.length !== 6 || (!profile?.year && !yearDraft)) && styles.checkInBtnDisabled,
                        ]}
                        onPress={submitCheckIn}
                        disabled={submittingCheckIn || codeInput.length !== 6 || (!profile?.year && !yearDraft)}
                      >
                        <Text style={styles.checkInBtnText}>{submittingCheckIn ? 'Checking in…' : 'Submit'}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  detailCard: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', maxHeight: '85%', ...shadow.card },
  closeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailImageWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  detailImage: { width: '100%', height: 200 },
  detailBody: { padding: spacing.lg, gap: spacing.xs },
  detailTitle: { fontSize: 19, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary },
  tag: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, marginBottom: spacing.xs },
  tagText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  description: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },

  checkInSection: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  checkInHint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.red,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  checkInBtnDisabled: { opacity: 0.5 },
  checkInBtnText: { color: colors.onAccent, fontWeight: '700', fontSize: 14 },
  checkedInRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  checkedInText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  checkInInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  checkInErrorText: { color: colors.red, fontSize: 13, marginBottom: spacing.sm },
  checkInActionRow: { flexDirection: 'row', gap: spacing.sm },
  checkInCancelBtn: { justifyContent: 'center', paddingHorizontal: spacing.md },
  checkInCancelText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  yearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  yearChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearChipActive: { backgroundColor: colors.red, borderColor: colors.red },
  yearChipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  yearChipTextActive: { color: colors.onAccent },
});
