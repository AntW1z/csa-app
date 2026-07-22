import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, Linking, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { Sponsor, SponsorLinkType } from '../../src/types';
import { colors, radius, spacing, shadow } from '../../src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2;

const CTA: Record<SponsorLinkType, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  website: { label: 'Visit', icon: 'globe-outline' },
  app: { label: 'Open App', icon: 'phone-portrait-outline' },
  directions: { label: 'Directions', icon: 'navigate-outline' },
};

export default function SponsorsScreen() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'sponsors'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setSponsors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sponsor))));
  }, []);

  const featured = sponsors.find((s) => s.featured && s.promoText);
  const rest = sponsors.filter((s) => s.id !== featured?.id);

  const open = (s: Sponsor) => s.link && Linking.openURL(s.link);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Our sponsors</Text>
      <Text style={styles.subheader}>Support the businesses that support CSA!</Text>

      {featured && (
        <Pressable style={styles.banner} onPress={() => open(featured)} disabled={!featured.link}>
          <Image source={{ uri: featured.imageUrl }} style={styles.bannerImage} resizeMode="cover" />
          <View style={styles.bannerOverlay}>
            <View style={styles.bannerBadge}>
              <Text style={styles.bannerBadgeText}>LIMITED PROMO</Text>
            </View>
            <Text style={styles.bannerPromo}>{featured.promoText}</Text>
            <Text style={styles.bannerName}>{featured.name}</Text>
          </View>
        </Pressable>
      )}

      {sponsors.length === 0 && <Text style={styles.empty}>No sponsors yet — check back soon!</Text>}

      <View style={styles.grid}>
        {rest.map((s) => {
          const cta = CTA[s.linkType ?? 'website'];
          return (
            <Pressable key={s.id} style={styles.card} onPress={() => open(s)} disabled={!s.link}>
              <View style={styles.cardImageWrap}>
                <Image source={{ uri: s.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                {s.promoText && (
                  <View style={styles.promoRibbon}>
                    <Text style={styles.promoRibbonText}>PROMO</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                {s.category && (
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryPillText}>{s.category}</Text>
                  </View>
                )}
                <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                {s.description ? <Text style={styles.description} numberOfLines={2}>{s.description}</Text> : null}
                {s.link && (
                  <View style={styles.ctaRow}>
                    <Ionicons name={cta.icon} size={13} color={colors.red} />
                    <Text style={styles.ctaText}>{cta.label}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subheader: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  empty: { color: colors.textMuted },

  banner: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  bannerImage: { width: '100%', height: 180, backgroundColor: colors.surfaceMuted },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bannerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.red,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.xs,
  },
  bannerBadgeText: { color: colors.onAccent, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  bannerPromo: { color: colors.onAccent, fontSize: 17, fontWeight: '800' },
  bannerName: { color: colors.onAccent, fontSize: 13, fontWeight: '600', marginTop: 2, opacity: 0.9 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardImageWrap: { position: 'relative' },
  cardImage: { width: '100%', height: CARD_WIDTH, backgroundColor: colors.surfaceMuted },
  promoRibbon: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.red,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  promoRibbonText: { color: colors.onAccent, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  cardBody: { padding: spacing.sm, gap: 2 },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.amberSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: 2,
  },
  categoryPillText: { color: colors.amberSoftText, fontSize: 10, fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  description: { fontSize: 12, color: colors.textSecondary, marginTop: 1, lineHeight: 16 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  ctaText: { color: colors.red, fontSize: 12, fontWeight: '700' },
});
