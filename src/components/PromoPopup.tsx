import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Post } from '../types';
import { colors, radius, spacing } from '../theme';

const SKIP_SECONDS = 5;

// A full-screen, image-only takeover for whichever post is currently
// featured (see Manage → star a post) — shown once per app session
// (mounts fresh every launch, since Home resets on a cold start). Tapping
// the image opens that post's normal detail popup; tapping Skip (or
// letting the countdown hit 0) just dismisses it.
export default function PromoPopup({ post, onSkip, onPressImage }: { post: Post; onSkip: () => void; onPressImage: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(SKIP_SECONDS);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (secondsLeft <= 0) {
      onSkip();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, onSkip]);

  return (
    <Modal animationType="fade" onRequestClose={onSkip}>
      <Pressable style={styles.screen} onPress={onPressImage}>
        {post.imageUrl ? (
          <>
            {/* A blurred, scaled-up copy of the same image fills the letterbox
                space behind it — the backdrop is literally made of the
                poster's own colors instead of a flat color that might clash. */}
            <Image source={{ uri: post.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" blurRadius={40} />
            <View style={[StyleSheet.absoluteFillObject, styles.scrim]} />
            <Image source={{ uri: post.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.red }]} />
        )}

        {/* Always tappable to skip immediately — the countdown is just a visual cue. */}
        <Pressable
          style={[styles.skipBtn, { top: insets.top + spacing.md }]}
          onPress={(e) => { e.stopPropagation(); onSkip(); }}
          accessibilityLabel="Skip"
        >
          <Text style={styles.skipText}>{secondsLeft > 0 ? `Skip ${secondsLeft}` : 'Skip'}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.textPrimary },
  scrim: { backgroundColor: 'rgba(0,0,0,0.25)' },
  skipBtn: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  skipText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
});
