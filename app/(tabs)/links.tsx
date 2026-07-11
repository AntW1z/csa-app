import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';

// Edit these to your club's real links.
const LINKS = [
  { label: 'Instagram', url: 'https://instagram.com/your_csa' },
  { label: 'Discord', url: 'https://discord.gg/your_invite' },
  { label: 'GroupMe', url: 'https://groupme.com/join_group/your_id' },
  { label: 'Website', url: 'https://your-csa-site.com' },
];

export default function LinksScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Find us</Text>
      {LINKS.map((link) => (
        <Pressable key={link.label} style={styles.row} onPress={() => Linking.openURL(link.url)}>
          <Text style={styles.label}>{link.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16, gap: 12 },
  header: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  row: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 14 },
  label: { fontSize: 15, fontWeight: '500' },
});
