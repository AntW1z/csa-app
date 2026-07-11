import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { collection, onSnapshot, orderBy, query, doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import PostCard from '../../src/components/PostCard';
import PromoPopup from '../../src/components/PromoPopup';
import { Post, PopupConfig } from '../../src/types';

export default function Home() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [popup, setPopup] = useState<PopupConfig | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  const isMemberOrAbove = !!profile && profile.role !== 'user';

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
      setPosts(all.filter((p) => p.visibility === 'everyone' || isMemberOrAbove));
    });
    return unsub;
  }, [isMemberOrAbove]);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, 'config', 'popup'));
      if (snap.exists()) {
        const data = snap.data() as PopupConfig;
        setPopup(data);
        setShowPopup(data.active);
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.feed}>
        <Text style={styles.header}>CSA</Text>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {posts.length === 0 && <Text style={styles.empty}>No posts yet.</Text>}
      </ScrollView>
      {popup && showPopup && <PromoPopup popup={popup} onClose={() => setShowPopup(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  feed: { padding: 16, gap: 12 },
  header: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  empty: { color: '#888', textAlign: 'center', marginTop: 40 },
});
