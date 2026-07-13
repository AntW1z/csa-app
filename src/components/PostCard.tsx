import { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Post } from '../types';
import { colors, radius, spacing, shadow, tagStyle } from '../theme';
import { formatEventTimeRange } from '../utils';
import PostDetailModal from './PostDetailModal';

const TAG_LABEL: Record<Post['type'], string> = {
  event: 'event',
  announcement: 'announcement',
  collab: 'collab',
};

// The card itself only shows the image/tag/title/time — tap it to see the
// location and full description in PostDetailModal, instead of cramming
// everything into the feed.
export default function PostCard({ post }: { post: Post }) {
  const [showDetail, setShowDetail] = useState(false);
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

      <PostDetailModal post={post} visible={showDetail} onClose={() => setShowDetail(false)} />
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
});
