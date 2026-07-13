import { useState } from 'react';
import { ScrollView, Text, Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { PushMessage } from '../../src/types';
import { colors, radius, spacing, shadow } from '../../src/theme';

export default function NotificationsScreen() {
  const { profile, visibleNotifications } = useAuth();
  const [openNotif, setOpenNotif] = useState<PushMessage | null>(null);

  const isRead = (n: PushMessage) => !!profile?.readNotificationIds?.includes(n.id);

  const openItem = (n: PushMessage) => {
    setOpenNotif(n);
    if (!profile || isRead(n)) return;
    updateDoc(doc(db, 'users', profile.uid), { readNotificationIds: arrayUnion(n.id) });
  };

  const deleteItem = (n: PushMessage) => {
    if (!profile) return;
    updateDoc(doc(db, 'users', profile.uid), { deletedNotificationIds: arrayUnion(n.id) });
    setOpenNotif(null);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {visibleNotifications.length === 0 && <Text style={styles.empty}>Nothing here yet.</Text>}
        {visibleNotifications.map((n) => {
          const read = isRead(n);
          return (
            <Pressable key={n.id} style={[styles.row, read && styles.rowRead]} onPress={() => openItem(n)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, !read && styles.titleUnread]} numberOfLines={1}>{n.title}</Text>
                <Text style={[styles.body, read && styles.bodyRead]} numberOfLines={1}>{n.body}</Text>
                <Text style={styles.meta}>{n.sentAt?.toDate ? n.sentAt.toDate().toLocaleString() : ''}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {openNotif && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={() => setOpenNotif(null)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.detailTitle}>{openNotif.title}</Text>
            <Text style={styles.detailMeta}>
              {openNotif.sentAt?.toDate ? openNotif.sentAt.toDate().toLocaleString() : ''}
            </Text>
            <Text style={styles.detailBody}>{openNotif.body}</Text>
            <Pressable style={styles.deleteBtn} onPress={() => deleteItem(openNotif)}>
              <Ionicons name="trash-outline" size={16} color={colors.red} />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  empty: { color: colors.textMuted },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  rowRead: { backgroundColor: colors.surfaceMuted },
  title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  titleUnread: { fontWeight: '800' },
  body: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  bodyRead: { color: colors.textMuted },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  closeBtn: { alignSelf: 'flex-end', marginBottom: spacing.xs },
  detailTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  detailMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: spacing.md },
  detailBody: { fontSize: 15, color: colors.textPrimary, lineHeight: 21 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
  },
  deleteBtnText: { color: colors.red, fontWeight: '700', fontSize: 14 },
});
