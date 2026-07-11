import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Switch, Image } from 'react-native';
import {
  collection, onSnapshot, query, where, orderBy, doc, updateDoc,
  addDoc, deleteDoc, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { Post, UserProfile, CarouselItem } from '../../src/types';
import { colors, radius, spacing, shadow, tagStyle } from '../../src/theme';

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
  const [imageUrl, setImageUrl] = useState('');
  const [carousel, setCarousel] = useState<CarouselItem[]>([]);
  const [carouselImageUrl, setCarouselImageUrl] = useState('');
  const [carouselLink, setCarouselLink] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'), where('memberRequestStatus', '==', 'pending'));
    return onSnapshot(q, (snap) => setPending(snap.docs.map((d) => d.data() as UserProfile)));
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'posts'), (snap) =>
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)))
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'carouselItems'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => setCarousel(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CarouselItem))));
  }, []);

  const approve = (uid: string) =>
    updateDoc(doc(db, 'users', uid), { role: 'member', memberRequestStatus: 'none' });

  const deny = (uid: string) =>
    updateDoc(doc(db, 'users', uid), { memberRequestStatus: 'none' });

  const createPost = async () => {
    if (!title || !profile) return;
    await addDoc(collection(db, 'posts'), {
      type, title, description, dateTime, locationText, visibility,
      ...(imageUrl ? { imageUrl } : {}),
      createdBy: profile.uid, createdAt: serverTimestamp(),
    });
    setTitle(''); setDescription(''); setDateTime(''); setLocationText(''); setImageUrl('');
  };

  const addCarouselItem = async () => {
    if (!carouselImageUrl) return;
    await addDoc(collection(db, 'carouselItems'), {
      imageUrl: carouselImageUrl,
      ...(carouselLink ? { link: carouselLink } : {}),
      createdAt: serverTimestamp(),
    });
    setCarouselImageUrl(''); setCarouselLink('');
  };

  const removeCarouselItem = (id: string) => deleteDoc(doc(db, 'carouselItems', id));

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
            <TextInput style={styles.input} placeholder="Image URL (optional)" autoCapitalize="none" value={imageUrl} onChangeText={setImageUrl} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Members only</Text>
              <Switch
                value={visibility === 'members'}
                onValueChange={(v) => setVisibility(v ? 'members' : 'everyone')}
                trackColor={{ true: colors.red, false: colors.borderStrong }}
              />
            </View>
            <Pressable style={styles.button} onPress={createPost}>
              <Text style={styles.buttonText}>Publish</Text>
            </Pressable>
          </View>

          <View>
            <Text style={styles.header}>Home carousel</Text>
            {carousel.length === 0 && <Text style={styles.empty}>No images in the rotation yet.</Text>}
            {carousel.map((item) => (
              <View key={item.id} style={styles.carouselRow}>
                <Image source={{ uri: item.imageUrl }} style={styles.carouselThumb} />
                <Text style={styles.carouselLink} numberOfLines={1}>{item.link || 'no link'}</Text>
                <Pressable onPress={() => removeCarouselItem(item.id)} hitSlop={8}>
                  <Text style={styles.deleteText}>delete</Text>
                </Pressable>
              </View>
            ))}
            <TextInput style={styles.input} placeholder="Image URL" autoCapitalize="none" value={carouselImageUrl} onChangeText={setCarouselImageUrl} />
            <TextInput style={styles.input} placeholder="Link when tapped (optional, e.g. /calendar)" autoCapitalize="none" value={carouselLink} onChangeText={setCarouselLink} />
            <Pressable style={styles.button} onPress={addCarouselItem}>
              <Text style={styles.buttonText}>Add to carousel</Text>
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
          <View style={[styles.postTag, { backgroundColor: tagStyle[item.type].bg }]}>
            <Text style={[styles.postTagText, { color: tagStyle[item.type].text }]}>{item.type}</Text>
          </View>
          <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
          <Pressable onPress={() => deleteDoc(doc(db, 'posts', item.id))} hitSlop={8}>
            <Text style={styles.deleteText}>delete</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  header: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  empty: { color: colors.textMuted },
  pendingRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadow.card,
  },
  pendingName: { fontSize: 13, color: colors.textPrimary },
  approveBtn: { backgroundColor: colors.success, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: spacing.md },
  approveText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  denyBtn: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: spacing.md },
  denyText: { color: colors.dangerText, fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  rowLabel: { fontSize: 14, color: colors.textPrimary },
  button: { backgroundColor: colors.red, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  buttonText: { color: colors.onAccent, fontWeight: '700' },
  resetBtn: { borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  resetText: { color: colors.red, fontWeight: '700' },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  postTag: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  postTagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  postTitle: { flex: 1, fontSize: 13, color: colors.textPrimary },
  deleteText: { color: colors.red, fontSize: 12, fontWeight: '600' },
  carouselRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  carouselThumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  carouselLink: { flex: 1, fontSize: 12, color: colors.textSecondary },
});
