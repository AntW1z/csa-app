import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Switch } from 'react-native';
import {
  collection, onSnapshot, query, where, doc, updateDoc,
  addDoc, deleteDoc, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { Post, UserProfile } from '../../src/types';

// This route is reachable by URL for anyone, but the tab is hidden for
// non-moderators (see (tabs)/_layout.tsx). Enforce the real boundary with
// Firestore security rules — see firestore.rules — never trust the UI alone.
export default function ModeratorScreen() {
  const { profile } = useAuth();
  const [pending, setPending] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [locationText, setLocationText] = useState('');
  const [visibility, setVisibility] = useState<'everyone' | 'members'>('everyone');
  const [type] = useState<'event' | 'announcement' | 'collab'>('event');

  useEffect(() => {
    const q = query(collection(db, 'users'), where('memberRequestStatus', '==', 'pending'));
    return onSnapshot(q, (snap) => setPending(snap.docs.map((d) => d.data() as UserProfile)));
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'posts'), (snap) =>
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)))
    );
  }, []);

  const approve = (uid: string) =>
    updateDoc(doc(db, 'users', uid), { role: 'member', memberRequestStatus: 'none' });

  const deny = (uid: string) =>
    updateDoc(doc(db, 'users', uid), { memberRequestStatus: 'none' });

  const createPost = async () => {
    if (!title || !profile) return;
    await addDoc(collection(db, 'posts'), {
      type, title, description, dateTime, locationText, visibility,
      createdBy: profile.uid, createdAt: serverTimestamp(),
    });
    setTitle(''); setDescription(''); setDateTime(''); setLocationText('');
  };

  // Admin-only, and scoped to role == 'member' so moderators/admins are
  // never touched by an accidental tap.
  const resetAllMembers = async () => {
    const q = query(collection(db, 'users'), where('role', '==', 'member'));
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((d) => updateDoc(doc(db, 'users', d.id), { role: 'user', memberRequestStatus: 'none' }))
    );
  };

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={posts}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ gap: 20 }}>
          <View>
            <Text style={styles.header}>Pending requests</Text>
            {pending.length === 0 && <Text style={styles.empty}>Nothing pending.</Text>}
            {pending.map((u) => (
              <View key={u.uid} style={styles.pendingRow}>
                <Text style={styles.pendingName}>{u.displayName} · {u.email}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable style={styles.approveBtn} onPress={() => approve(u.uid)}>
                    <Text style={styles.approveText}>Approve</Text>
                  </Pressable>
                  <Pressable style={styles.denyBtn} onPress={() => deny(u.uid)}>
                    <Text style={styles.denyText}>Deny</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          <View>
            <Text style={styles.header}>New post</Text>
            <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
            <TextInput style={styles.input} placeholder="Description" value={description} onChangeText={setDescription} multiline />
            <TextInput style={styles.input} placeholder="Date / time (optional)" value={dateTime} onChangeText={setDateTime} />
            <TextInput style={styles.input} placeholder="Location (optional)" value={locationText} onChangeText={setLocationText} />
            <View style={styles.row}>
              <Text>Members only</Text>
              <Switch value={visibility === 'members'} onValueChange={(v) => setVisibility(v ? 'members' : 'everyone')} />
            </View>
            <Pressable style={styles.button} onPress={createPost}>
              <Text style={styles.buttonText}>Publish</Text>
            </Pressable>
          </View>

          {profile?.role === 'admin' && (
            <Pressable style={styles.resetBtn} onPress={resetAllMembers}>
              <Text style={styles.resetText}>Reset all members (year-end)</Text>
            </Pressable>
          )}

          <Text style={styles.header}>All posts</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.postRow}>
          <Text style={styles.postTitle}>{item.title}</Text>
          <Pressable onPress={() => deleteDoc(doc(db, 'posts', item.id))}>
            <Text style={styles.deleteText}>delete</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  header: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  empty: { color: '#888' },
  pendingRow: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 10, marginBottom: 8, gap: 8 },
  pendingName: { fontSize: 13 },
  approveBtn: { backgroundColor: '#EAF3DE', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  approveText: { color: '#27500A', fontSize: 12, fontWeight: '600' },
  denyBtn: { backgroundColor: '#FCEBEB', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  denyText: { color: '#791F1F', fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  button: { backgroundColor: '#A32D2D', borderRadius: 8, padding: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  resetBtn: { borderWidth: 1, borderColor: '#A32D2D', borderRadius: 8, padding: 12, alignItems: 'center' },
  resetText: { color: '#A32D2D', fontWeight: '600' },
  postRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#f0f0f0', paddingVertical: 8 },
  postTitle: { fontSize: 13 },
  deleteText: { color: '#A32D2D', fontSize: 12 },
});
