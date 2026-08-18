import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Post } from '../types';
import { colors, radius, spacing, shadow, tagStyle } from '../theme';
import { formatEventTimeRange } from '../utils';

const TAG_LABEL: Record<Post['type'], string> = {
  event: 'event',
  announcement: 'announcement',
  collab: 'collab',
};

// The card itself only shows the image/tag/title/time — tap it to see the
// location and full description in PostDetailModal. That modal is a plain
// absolute-positioned overlay (not RN's <Modal>, which broke scrolling on
// long descriptions), so it has to be rendered by the screen itself rather
// than nested in here — nested inside a grid cell, "cover the whole
// screen" would only cover that cell. onPress is owned by the caller.
export default function PostCard({ post, onPress }: { post: Post; onPress: () => void }) {
  const time = formatEventTimeRange(post.dateTime, post.endDateTime, post.allDay);
  const tag = tagStyle[post.type];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.image} resizeMode="cover" /> : null}
      <View style={styles.content}>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <View style={[styles.tag, { backgroundColor: tag.bg }]}>
            <Text style={[styles.tagText, { color: tag.text }]}>{TAG_LABEL[post.type]}</Text>
          </View>
          {/* Only a moderator ever sees a draft post at all (see the
              Events tab's visibility filter), but the badge still helps
              tell it apart from what's actually live at a glance. */}
          {post.status === 'draft' && (
            <View style={[styles.tag, { backgroundColor: colors.neutralSoft }]}>
              <Text style={[styles.tagText, { color: colors.neutralSoftText }]}>draft</Text>
            </View>
          )}
        </View>
        <Text style={styles.title} numberOfLines={2}>{post.title}</Text>
        {time ? <Text style={styles.meta}>{time}</Text> : null}
      </View>
    </Pressable>
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
});
