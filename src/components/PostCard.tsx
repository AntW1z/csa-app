import { View, Text, StyleSheet } from 'react-native';
import { Post } from '../types';

const TAG_LABEL: Record<Post['type'], string> = {
  event: 'event',
  announcement: 'announcement',
  collab: 'collab',
};

export default function PostCard({ post }: { post: Post }) {
  const meta = [post.dateTime, post.locationText].filter(Boolean).join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.tag}>
        <Text style={styles.tagText}>{TAG_LABEL[post.type]}</Text>
      </View>
      <Text style={styles.title}>{post.title}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      <Text style={styles.description}>{post.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, gap: 4 },
  tag: { alignSelf: 'flex-start', backgroundColor: '#FCEBEB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 },
  tagText: { fontSize: 11, color: '#791F1F', fontWeight: '600' },
  title: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, color: '#666' },
  description: { fontSize: 13, color: '#333', marginTop: 2 },
});
