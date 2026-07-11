import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow } from '../../src/theme';

// Edit these to your club's real links.
const LINKS: { label: string; url: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Instagram', url: 'https://instagram.com/your_csa', icon: 'logo-instagram' },
  { label: 'Discord', url: 'https://discord.gg/your_invite', icon: 'logo-discord' },
  { label: 'GroupMe', url: 'https://groupme.com/join_group/your_id', icon: 'chatbubbles-outline' },
  { label: 'Website', url: 'https://your-csa-site.com', icon: 'globe-outline' },
];

export default function LinksScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Find us</Text>
      {LINKS.map((link) => (
        <Pressable key={link.label} style={styles.row} onPress={() => Linking.openURL(link.url)}>
          <View style={styles.iconWrap}>
            <Ionicons name={link.icon} size={18} color={colors.red} />
          </View>
          <Text style={styles.label}>{link.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  header: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  iconWrap: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
});
