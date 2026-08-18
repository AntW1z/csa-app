import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/firebase';
import PromoCarousel from '../../src/components/PromoCarousel';
import PostDetailModal from '../../src/components/PostDetailModal';
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

  // A carousel item linked to a post fetches it on demand (they're rarely
  // tapped, so no need for a standing listener) and opens its detail; a
  // plain manually-added image has no tap behavior at all.
  const handleCarouselPress = async (item: CarouselItem) => {
    if (!item.postId) return;
    const snap = await getDoc(doc(db, 'posts', item.postId));
    if (snap.exists()) {
      setDetailPostId(item.postId);
      setShowDetail(true);
    }
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

      {detailPost && (
        <PostDetailModal post={detailPost} visible={showDetail} onClose={() => setShowDetail(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
