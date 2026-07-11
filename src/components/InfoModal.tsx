import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow } from '../theme';

export default function InfoModal({
  visible,
  title,
  body,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.bodyScroll}>
            <Text style={styles.body}>{body}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, maxHeight: '70%', ...shadow.card },
  closeBtn: { alignSelf: 'flex-end' },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.xs, marginBottom: spacing.sm },
  bodyScroll: { marginTop: spacing.xs },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
});
