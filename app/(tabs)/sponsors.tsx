import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { Sponsor, SponsorCategory, SponsorKind } from '../../src/types';
import { colors, radius, spacing, shadow } from '../../src/theme';
import { isPromoLive, sortByOrder } from '../../src/utils';

const ROW_CARD_WIDTH = 150;

const CATEGORY_LABEL: Record<SponsorCategory, string> = {
  food: 'Food & Drink',
  services: 'Services',
  other: 'Other',
};
const CATEGORY_ORDER: SponsorCategory[] = ['food', 'services', 'other'];

// A true catch-all — anything that isn't exactly 'food' or 'services'
// resolves to 'other', so a sponsor created before this category picker
// existed (or with any unexpected value) still shows up somewhere instead
// of silently disappearing.
const resolveCategory = (s: Sponsor): SponsorCategory =>
  s.category === 'food' || s.category === 'services' ? s.category : 'other';

// Sponsors created before the kind picker existed have no `kind` field —
// they're all "information" (the only kind that used to exist).
const resolveSponsorKind = (s: Sponsor): SponsorKind => (s.kind === 'event' ? 'event' : 'information');

const formatEventDate = (d?: string) => {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// `end` is only ever set when the event actually spans multiple days (see
// the "runs over multiple days" toggle in Manage) — a single-day event
// just shows its one date.
const formatEventDateRange = (start?: string, end?: string) => {
  if (!start) return '';
  if (!end || end === start) return formatEventDate(start);
  return `${formatEventDate(start)} – ${formatEventDate(end)}`;
};

export default function SponsorsScreen() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [selected, setSelected] = useState<Sponsor | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'sponsors'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setSponsors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sponsor))));
  }, []);

  const sorted = sortByOrder(sponsors);
  const informationSponsors = sorted.filter((s) => resolveSponsorKind(s) === 'information');
  const events = sorted.filter((s) => resolveSponsorKind(s) === 'event');

  const liveOffers = informationSponsors.filter(isPromoLive);
  // While a sponsor's deal is live, they're already shown in the offers
  // row above — showing them again in their category row too would just
  // duplicate the same sponsor twice on the same page. Once the offer's
  // date range passes, isPromoLive stops matching and they reappear here
  // automatically, no moderator action needed either way.
  const rows = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABEL[cat],
    items: informationSponsors.filter((s) => resolveCategory(s) === cat && !isPromoLive(s)),
  })).filter((r) => r.items.length > 0);

  const openLink = (url: string) => Linking.openURL(url);

  const linkedSponsor = selected?.linkedSponsorId
    ? sponsors.find((s) => s.id === selected.linkedSponsorId) ?? null
    : null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Our sponsors</Text>
        <Text style={styles.subheader}>Support the businesses that support CSA!</Text>

        {sponsors.length === 0 && <Text style={styles.empty}>No sponsors yet — check back soon!</Text>}

        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Sponsor events</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowContent}>
              {events.map((s) => (
                <Pressable key={s.id} style={styles.banner} onPress={() => setSelected(s)}>
                  <Image source={{ uri: s.imageUrl }} style={styles.bannerImage} resizeMode="cover" />
                  <View style={styles.bannerOverlay}>
                    {s.eventDate ? <Text style={styles.bannerPromo} numberOfLines={1}>{formatEventDateRange(s.eventDate, s.eventEndDate)}</Text> : null}
                    <Text style={styles.bannerName}>{s.name}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {liveOffers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Limited-time offers</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowContent}>
              {liveOffers.map((s) => (
                <Pressable key={s.id} style={styles.banner} onPress={() => setSelected(s)}>
                  <Image source={{ uri: s.imageUrl }} style={styles.bannerImage} resizeMode="cover" />
                  <View style={styles.bannerOverlay}>
                    <Text style={styles.bannerPromo} numberOfLines={2}>{s.promoText}</Text>
                    <Text style={styles.bannerName}>{s.name}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {rows.map((row) => (
          <View key={row.category} style={styles.section}>
            <Text style={styles.sectionLabel}>{row.label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowContent}>
              {row.items.map((s) => (
                <Pressable key={s.id} style={styles.card} onPress={() => setSelected(s)}>
                  <View style={styles.cardImageWrap}>
                    <Image source={{ uri: s.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                    {isPromoLive(s) && (
                      <View style={styles.promoRibbon}>
                        <Text style={styles.promoRibbonText}>OFFER</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {selected && (
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.closeBtn} onPress={() => setSelected(null)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.onAccent} />
            </Pressable>
            <ScrollView>
              <Image source={{ uri: selected.imageUrl }} style={styles.detailImage} resizeMode="cover" />
              <View style={styles.detailBody}>
                {resolveSponsorKind(selected) === 'information' ? (
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryPillText}>{CATEGORY_LABEL[resolveCategory(selected)]}</Text>
                  </View>
                ) : (
                  selected.eventDate && (
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryPillText}>{formatEventDateRange(selected.eventDate, selected.eventEndDate)}</Text>
                    </View>
                  )
                )}
                <Text style={styles.detailName}>{selected.name}</Text>

                {resolveSponsorKind(selected) === 'event' && linkedSponsor && (
                  <Pressable style={styles.sponsorCreditRow} onPress={() => setSelected(linkedSponsor)}>
                    <Text style={styles.sponsorCreditLabel}>Sponsor:</Text>
                    <Image source={{ uri: linkedSponsor.imageUrl }} style={styles.sponsorCreditAvatar} />
                    <Text style={styles.sponsorCreditName} numberOfLines={1}>{linkedSponsor.name}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                )}

                {isPromoLive(selected) && (
                  <View style={styles.detailPromoBox}>
                    <Text style={styles.detailPromoLabel}>LIMITED-TIME OFFER</Text>
                    <Text style={styles.detailPromoText}>{selected.promoText}</Text>
                  </View>
                )}

                {selected.description ? <Text style={styles.detailDescription}>{selected.description}</Text> : null}

                {selected.links?.map((link, i) => (
                  <Pressable key={i} style={styles.ctaBtn} onPress={() => openLink(link.url)}>
                    <Ionicons name="open-outline" size={16} color={colors.onAccent} style={styles.ctaBtnIcon} />
                    <Text style={styles.ctaBtnText}>{link.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subheader: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
  empty: { color: colors.textMuted },

  section: { marginTop: spacing.lg },
  sectionLabel: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  rowContent: { gap: spacing.md, paddingRight: spacing.lg },

  banner: {
    width: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  bannerImage: { width: '100%', height: 140, backgroundColor: colors.surfaceMuted },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bannerPromo: { color: colors.onAccent, fontSize: 14, fontWeight: '800' },
  bannerName: { color: colors.onAccent, fontSize: 12, fontWeight: '600', marginTop: 2, opacity: 0.9 },

  card: { width: ROW_CARD_WIDTH },
  cardImageWrap: { position: 'relative' },
  cardImage: {
    width: ROW_CARD_WIDTH,
    height: ROW_CARD_WIDTH,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  promoRibbon: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.red,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  promoRibbonText: { color: colors.onAccent, fontSize: 9, fontWeight: '800' },
  name: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.xs },
  cardSubtext: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

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
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, maxHeight: '85%', overflow: 'hidden', ...shadow.card },
  closeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.pill,
    padding: 4,
  },
  detailImage: { width: '100%', height: 200, backgroundColor: colors.surfaceMuted },
  detailBody: { padding: spacing.lg, gap: spacing.sm },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.amberSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  categoryPillText: { color: colors.amberSoftText, fontSize: 10, fontWeight: '700' },
  detailName: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  sponsorCreditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  sponsorCreditLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  sponsorCreditAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface },
  sponsorCreditName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, maxWidth: 140 },
  detailPromoBox: {
    backgroundColor: colors.redSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  detailPromoLabel: { color: colors.redSoftText, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  detailPromoText: { color: colors.redSoftText, fontSize: 14, fontWeight: '700' },
  detailDescription: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: spacing.xs,
    backgroundColor: colors.red,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  ctaBtnIcon: { marginTop: 2 },
  ctaBtnText: { flexShrink: 1, color: colors.onAccent, fontWeight: '700', fontSize: 14 },
});
