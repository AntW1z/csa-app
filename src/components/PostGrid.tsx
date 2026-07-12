import { View, useWindowDimensions, StyleSheet } from 'react-native';
import PostCard from './PostCard';
import { Post } from '../types';
import { spacing } from '../theme';

// Single column on phones (where a stretched full-width card reads fine),
// stepping up to more columns as the viewport gets wider — mainly for web,
// where one card stretched edge-to-edge on a desktop window looks broken.
function columnsForWidth(width: number) {
  if (width >= 1100) return 3;
  if (width >= 700) return 2;
  return 1;
}

export default function PostGrid({ posts }: { posts: Post[] }) {
  const { width } = useWindowDimensions();
  const columns = columnsForWidth(width);

  return (
    <View style={styles.grid}>
      {posts.map((post) => (
        <View key={post.id} style={[styles.cell, { width: `${100 / columns}%` }]}>
          <PostCard post={post} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  cell: { padding: spacing.xs },
});
