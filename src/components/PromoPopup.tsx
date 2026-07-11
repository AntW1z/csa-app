import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Linking, Image } from 'react-native';
import { PopupConfig } from '../types';
import { colors, radius, spacing, shadow } from '../theme';

const SKIP_SECONDS = 5;

// Deliberately reappears every time this component mounts (i.e. every app
// launch), since that's the behavior we want: closing it only dismisses it
// for the current session, not forever.
export default function PromoPopup({ popup, onClose }: { popup: PopupConfig; onClose: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(SKIP_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onClose();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, onClose]);

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {popup.imageUrl ? (
            <Image source={{ uri: popup.imageUrl }} style={styles.image} resizeMode="cover" />
          ) : null}
          {/* Always tappable to skip immediately — the countdown is just a visual cue. */}
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel="Skip">
            <Text style={styles.closeText}>{secondsLeft > 0 ? `Skip ${secondsLeft}s` : 'Skip'}</Text>
          </Pressable>
          <View style={styles.body}>
            <Text style={styles.title}>{popup.title}</Text>
            <Text style={styles.description} numberOfLines={2}>{popup.description}</Text>
            {popup.ctaText ? (
              <Pressable
                style={styles.cta}
                onPress={() => {
                  if (popup.ctaLink) Linking.openURL(popup.ctaLink);
                  onClose();
                }}
              >
                <Text style={styles.ctaText}>{popup.ctaText}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card },
  image: { width: '100%', height: 160, backgroundColor: colors.surfaceMuted },
  closeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  body: { padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  description: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 19 },
  cta: { backgroundColor: colors.red, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  ctaText: { color: colors.onAccent, fontWeight: '700', fontSize: 14 },
});
