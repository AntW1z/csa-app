import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import PostCard from '../../src/components/PostCard';
import { Post } from '../../src/types';
import { colors, spacing } from '../../src/theme';

// v1 is a simple upcoming-events list, sorted by date. Swap in a real grid
// (e.g. react-native-calendars) once the basics are working end to end.
export default function CalendarScreen() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<Post[]>([]);
  const isMemberOrAbove = !!profile && profile.role !== 'user';

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('type', '==', 'event'), orderBy('dateTime', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
      setEvents(all.filter((p) => p.visibility === 'everyone' || isMemberOrAbove));
    });
    return unsub;
  }, [isMemberOrAbove]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Upcoming events</Text>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <PostCard post={item} />}
        ListEmptyComponent={<Text style={styles.empty}>No upcoming events.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, padding: spacing.lg, paddingBottom: 0 },
  list: { gap: spacing.md, padding: spacing.lg },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
});
