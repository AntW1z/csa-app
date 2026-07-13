import { ScrollView, Text, Pressable, View, StyleSheet } from 'react-native';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { PushMessage } from '../../src/types';
import { colors, radius, spacing, shadow } from '../../src/theme';

export default function NotificationsScreen() {
  const { profile, visibleNotifications } = useAuth();

  const isRead = (n: PushMessage) => !!profile?.readNotificationIds?.includes(n.id);

  const markRead = (n: PushMessage) => {
    if (!profile || isRead(n)) return;
    updateDoc(doc(db, 'users', profile.uid), { readNotificationIds: arrayUnion(n.id) });
  };

  const unread = visibleNotifications.filter((n) => !isRead(n));
  const read = visibleNotifications.filter((n) => isRead(n));

  const renderRow = (n: PushMessage, unreadFlag: boolean) => (
    <Pressable key={n.id} style={styles.row} onPress={() => markRead(n)}>
      {unreadFlag && <View style={styles.dot} />}
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, unreadFlag && styles.titleUnread]}>{n.title}</Text>
        <Text style={styles.body}>{n.body}</Text>
        <Text style={styles.meta}>{n.sentAt?.toDate ? n.sentAt.toDate().toLocaleString() : ''}</Text>
      </View>
    </Pressable>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Unread ({unread.length})</Text>
      {unread.length === 0 && <Text style={styles.empty}>You're all caught up.</Text>}
      {unread.map((n) => renderRow(n, true))}

      <Text style={[styles.header, { marginTop: spacing.xl }]}>Read</Text>
      {read.length === 0 && <Text style={styles.empty}>Nothing here yet.</Text>}
      {read.map((n) => renderRow(n, false))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  empty: { color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red, marginTop: 6 },
  title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  titleUnread: { fontWeight: '800' },
  body: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
});
