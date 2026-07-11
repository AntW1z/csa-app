import { View, Text, Image, StyleSheet } from 'react-native';
import { Post } from '../types';
import { colors, radius, spacing, shadow, tagStyle } from '../theme';

const TAG_LABEL: Record<Post['type'], string> = {
  event: 'event',
  announcement: 'announcement',
  collab: 'collab',
};

export default function PostCard({ post }: { post: Post }) {
  const meta = [post.dateTime, post.locationText].filter(Boolean).join(' · ');
  const tag = tagStyle[post.type];

  return (
    <View style={styles.card}>
      {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.image} resizeMode="cover" /> : null}
      <View style={styles.content}>
        <View style={[styles.tag, { backgroundColor: tag.bg }]}>
          <Text style={[styles.tagText, { color: tag.text }]}>{TAG_LABEL[post.type]}</Text>
        </View>
        <Text style={styles.title}>{post.title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {post.description ? <Text style={styles.description}>{post.description}</Text> : null}
      </View>
    </View>
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
  image: { width: '100%', height: 160, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.lg, gap: spacing.xs },
  tag: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, marginBottom: spacing.xs },
  tagText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary },
  description: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
