import { useRef, useState } from 'react';
import { Alert, Text, Pressable, View, StyleSheet } from 'react-native';
import { Swipeable, ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { PushMessage } from '../../src/types';
import { colors, radius, spacing, shadow } from '../../src/theme';

export default function NotificationsScreen() {
  const { profile, visibleNotifications } = useAuth();
  const [openNotif, setOpenNotif] = useState<PushMessage | null>(null);
  const rowRefs = useRef<Record<string, Swipeable | null>>({});

  const isRead = (n: PushMessage) => !!profile?.readNotificationIds?.includes(n.id);

  const openItem = (n: PushMessage) => {
    setOpenNotif(n);
    if (!profile || isRead(n)) return;
    updateDoc(doc(db, 'users', profile.uid), { readNotificationIds: arrayUnion(n.id) });
  };

  const toggleRead = (n: PushMessage) => {
    if (!profile) return;
    updateDoc(doc(db, 'users', profile.uid), {
      readNotificationIds: isRead(n) ? arrayRemove(n.id) : arrayUnion(n.id),
    });
    rowRefs.current[n.id]?.close();
  };

  const deleteItem = (n: PushMessage) => {
    if (!profile) return;
    updateDoc(doc(db, 'users', profile.uid), { deletedNotificationIds: arrayUnion(n.id) });
    rowRefs.current[n.id]?.close();
    setOpenNotif((cur) => (cur?.id === n.id ? null : cur));
  };

  const clearAll = () => {
    if (!profile || visibleNotifications.length === 0) return;
    Alert.alert(
      'Clear all notifications?',
      'This removes every notification from your inbox. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            updateDoc(doc(db, 'users', profile.uid), {
              deletedNotificationIds: arrayUnion(...visibleNotifications.map((n) => n.id)),
            });
          },
        },
      ]
    );
  };

  const renderRightActions = (n: PushMessage) => (
    <View style={styles.swipeActions}>
      <Pressable style={styles.swipeToggleBtn} onPress={() => toggleRead(n)}>
        <Ionicons name={isRead(n) ? 'mail-unread-outline' : 'mail-open-outline'} size={18} color={colors.onAccent} />
        <Text style={styles.swipeBtnText}>{isRead(n) ? 'Unread' : 'Read'}</Text>
      </Pressable>
      <Pressable style={styles.swipeDeleteBtn} onPress={() => deleteItem(n)}>
        <Ionicons name="trash-outline" size={18} color={colors.onAccent} />
        <Text style={styles.swipeBtnText}>Delete</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {visibleNotifications.length > 0 && (
          <Pressable onPress={clearAll} hitSlop={8}>
            <Text style={styles.clearAllText}>Clear all</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {visibleNotifications.length === 0 && <Text style={styles.empty}>Nothing here yet.</Text>}
        {visibleNotifications.map((n) => {
          const read = isRead(n);
          return (
            <Swipeable
              key={n.id}
              ref={(ref) => { rowRefs.current[n.id] = ref; }}
              renderRightActions={() => renderRightActions(n)}
              overshootRight={false}
            >
              <Pressable style={[styles.row, read && styles.rowRead]} onPress={() => openItem(n)}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, !read && styles.titleUnread]} numberOfLines={1}>{n.title}</Text>
                    {!read && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.body, read && styles.bodyRead]} numberOfLines={1}>{n.body}</Text>
                  <Text style={styles.meta}>{n.sentAt?.toDate ? n.sentAt.toDate().toLocaleString() : ''}</Text>
                </View>
              </Pressable>
            </Swipeable>
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
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  clearAllText: { color: colors.red, fontSize: 13, fontWeight: '700' },
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  titleUnread: { fontWeight: '800' },
  newBadge: { backgroundColor: colors.red, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  newBadgeText: { color: colors.onAccent, fontSize: 9, fontWeight: '800' },
  body: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  bodyRead: { color: colors.textMuted },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
  swipeActions: { flexDirection: 'row', alignItems: 'stretch', marginBottom: spacing.sm },
  swipeToggleBtn: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.neutralSoftText,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
  },
  swipeDeleteBtn: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.red,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  swipeBtnText: { color: colors.onAccent, fontSize: 11, fontWeight: '700' },
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
});
