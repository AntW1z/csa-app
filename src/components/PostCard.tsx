import { useState } from 'react';
import { View, Text, Image, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Post } from '../types';
import { colors, radius, spacing, shadow, tagStyle } from '../theme';
import { formatEventTimeRange } from '../utils';

const TAG_LABEL: Record<Post['type'], string> = {
  event: 'event',
  announcement: 'announcement',
  collab: 'collab',
};

// The card itself only shows the image/tag/title/time — tap it to see the
// location and full description in a popup, instead of cramming everything
// into the feed.
export default function PostCard({ post }: { post: Post }) {
  const [showDetail, setShowDetail] = useState(false);
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const time = formatEventTimeRange(post.dateTime, post.endDateTime, post.allDay);
  const tag = tagStyle[post.type];

  return (
    <>
      <Pressable style={styles.card} onPress={() => setShowDetail(true)}>
        {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.image} resizeMode="cover" /> : null}
        <View style={styles.content}>
          <View style={[styles.tag, { backgroundColor: tag.bg }]}>
            <Text style={[styles.tagText, { color: tag.text }]}>{TAG_LABEL[post.type]}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>{post.title}</Text>
          {time ? <Text style={styles.meta}>{time}</Text> : null}
        </View>
      </Pressable>

      <Modal visible={showDetail} transparent animationType="fade" onRequestClose={() => setShowDetail(false)}>
        {/* Tapping the dimmed backdrop closes the popup; the inner Pressable
            stops that tap from bubbling up when it lands on the card itself. */}
        <Pressable style={styles.overlay} onPress={() => setShowDetail(false)}>
          <Pressable style={styles.detailCard} onPress={(e) => e.stopPropagation()}>
            <Pressable style={styles.closeBtn} onPress={() => setShowDetail(false)} hitSlop={8}>
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
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  image: { width: '100%', height: 140, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.md, gap: spacing.xs },
  tag: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, marginBottom: spacing.xs },
  tagText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
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
  description: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },
});
