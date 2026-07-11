import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { Post } from '../../src/types';

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
        contentContainerStyle={{ gap: 12, padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>{[item.dateTime, item.locationText].filter(Boolean).join(' · ')}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No upcoming events.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { fontSize: 20, fontWeight: '600', padding: 16, paddingBottom: 0 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12 },
  title: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});
