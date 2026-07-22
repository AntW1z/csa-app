import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { Sponsor } from '../../src/types';
import { colors, radius, spacing, shadow } from '../../src/theme';

export default function SponsorsScreen() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'sponsors'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setSponsors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sponsor))));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Our sponsors</Text>
      <Text style={styles.subheader}>Thank you to the businesses that support CSA.</Text>

      {sponsors.length === 0 && <Text style={styles.empty}>No sponsors yet — check back soon!</Text>}

      {sponsors.map((s) => (
        <Pressable
          key={s.id}
          style={styles.card}
          onPress={() => s.link && Linking.openURL(s.link)}
          disabled={!s.link}
        >
          <Image source={{ uri: s.imageUrl }} style={styles.image} resizeMode="cover" />
          <View style={styles.cardBody}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{s.name}</Text>
              {s.link && <Ionicons name="open-outline" size={16} color={colors.textMuted} />}
            </View>
            {s.description ? <Text style={styles.description}>{s.description}</Text> : null}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  header: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subheader: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  empty: { color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  image: { width: '100%', height: 160, backgroundColor: colors.surfaceMuted },
  cardBody: { padding: spacing.md, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  description: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});
