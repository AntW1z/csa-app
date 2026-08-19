import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../src/firebase';
import PromoCarousel from '../../src/components/PromoCarousel';
import PostDetailModal from '../../src/components/PostDetailModal';
import { FloatingProfileButton, FloatingNotificationsButton } from './_layout';
import { Post, CarouselItem } from '../../src/types';
import { colors, radius, spacing, shadow } from '../../src/theme';
import { sortByOrder } from '../../src/utils';

// Home is just the carousel, full-bleed — no feed, no launch popup. A
// moderator-curated image already covers "what's worth seeing right now"
// (see Manage > Home carousel), so a separate list of this week's posts
// and a separate ad popup were redundant with it rather than additive.
export default function Home() {
  const router = useRouter();
  const [postsById, setPostsById] = useState<Record<string, Post>>({});
  const [carousel, setCarousel] = useState<CarouselItem[]>([]);
  const [carouselLoading, setCarouselLoading] = useState(true);
  // An id, not a captured Post object — looked up in postsById (already
  // kept live by the listener below) on every render, so e.g. this
  // account's own check-in write shows up immediately instead of needing
  // the modal reopened to re-fetch a fresh copy.
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
      // Keyed by id so a post-linked carousel item can always show that
      // post's *current* image (see resolvedCarousel below) instead of the
      // snapshot copy saved on the carousel item at link time.
      setPostsById(Object.fromEntries(all.map((p) => [p.id, p])));
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'carouselItems'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      setCarousel(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CarouselItem)));
      setCarouselLoading(false);
    });
  }, []);

  // Tab screens stay mounted when you switch away (Expo Router doesn't
  // unmount them), so an open popup would otherwise still be sitting there
  // when you come back to this tab later — closing it on blur means
  // leaving the tab always resets to a clean state.
  useFocusEffect(
    useCallback(() => {
      return () => setShowDetail(false);
    }, [])
  );

  // A carousel item linked to a post opens its detail using data already
  // sitting in postsById (the listener above is already running for
  // resolvedCarousel's own use, right below) — no need for a one-off
  // network fetch here, which used to make the tap wait on a full
  // round-trip before the modal would even open. A plain manually-added
  // image has no tap behavior at all.
  const handleCarouselPress = (item: CarouselItem) => {
    if (!item.postId || !postsById[item.postId]) return;
    setDetailPostId(item.postId);
    setShowDetail(true);
  };
  const detailPost = detailPostId ? postsById[detailPostId] ?? null : null;

  const resolvedCarousel = sortByOrder(carousel).map((item) =>
    item.postId && postsById[item.postId] ? { ...item, imageUrl: postsById[item.postId].imageUrl ?? item.imageUrl } : item
  );

  return (
    <View style={styles.container}>
      {/* Firestore's first response is variable-latency (network/cache
          dependent) — without this, the gap before it arrives rendered as
          a fully blank white screen instead of the small, easy-to-miss gap
          it used to be back when the carousel was just a short strip. */}
      {carouselLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.red} />
        </View>
      ) : (
        <PromoCarousel items={resolvedCarousel} onPressItem={handleCarouselPress} />
      )}

      <Pressable style={styles.ctaBtn} onPress={() => router.push('/calendar')}>
        <Text style={styles.ctaBtnText}>Check out Events</Text>
      </Pressable>

      {/* Rendered as normal screen content, not a navigator header (see
          _layout.tsx) — and specifically *before* the modal below, so its
          full-screen popup naturally stacks on top of these and covers
          them the same way it covers the carousel and CTA button, with no
          manual disabling needed. box-none lets touches on the empty space
          between the two buttons fall through to the carousel underneath. */}
      <SafeAreaView edges={['top']} style={styles.floatingHeaderRow} pointerEvents="box-none">
        <FloatingProfileButton />
        <FloatingNotificationsButton />
      </SafeAreaView>

      {detailPost && (
        <PostDetailModal post={detailPost} visible={showDetail} onClose={() => setShowDetail(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  floatingHeaderRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ctaBtn: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadow.card,
  },
  ctaBtnText: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
});
