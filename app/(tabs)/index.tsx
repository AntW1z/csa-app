import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query, doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import PostGrid from '../../src/components/PostGrid';
import PromoPopup from '../../src/components/PromoPopup';
import PromoCarousel from '../../src/components/PromoCarousel';
import InfoModal from '../../src/components/InfoModal';
import { Post, PopupConfig, CarouselItem } from '../../src/types';
import { colors, radius, spacing, shadow } from '../../src/theme';
import { getEventWindow } from '../../src/utils';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isUpcomingThisWeek(post: Post, now: Date) {
  const window = getEventWindow(post);
  if (!window) return false;
  return window.end >= now && window.start <= new Date(now.getTime() + WEEK_MS);
}

const WHAT_IS_CSA = `CSA (Chinese Student Association) is a student-run club bringing together anyone interested in Chinese culture and community. We host general body meetings, cultural events, socials, and collaborations with other orgs throughout the year.

(Filler text — swap this out for your club's real description.)`;

export default function Home() {
  const router = useRouter();
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [carousel, setCarousel] = useState<CarouselItem[]>([]);
  const [popup, setPopup] = useState<PopupConfig | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const isMemberOrAbove = !!profile && profile.role !== 'user';

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
      const now = new Date();
      const upcoming = all
        .filter((p) => (p.visibility === 'everyone' || isMemberOrAbove) && isUpcomingThisWeek(p, now))
        .sort((a, b) => new Date(a.dateTime ?? 0).getTime() - new Date(b.dateTime ?? 0).getTime());
      setPosts(upcoming);
    });
    return unsub;
  }, [isMemberOrAbove]);

  useEffect(() => {
    const q = query(collection(db, 'carouselItems'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) =>
      setCarousel(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CarouselItem)))
    );
  }, []);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, 'config', 'popup'));
      if (snap.exists()) {
        const data = snap.data() as PopupConfig;
        setPopup(data);
        setShowPopup(data.active);
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PromoCarousel items={carousel} />
        <View style={styles.body}>
          <View style={styles.quickActions}>
            <Pressable style={styles.quickAction} onPress={() => router.push('/calendar')}>
              <Ionicons name="calendar-outline" size={16} color={colors.red} />
              <Text style={styles.quickActionText}>Calendar</Text>
            </Pressable>
            <Pressable style={styles.quickAction} onPress={() => setShowInfo(true)}>
              <Ionicons name="help-circle-outline" size={16} color={colors.red} />
              <Text style={styles.quickActionText}>What is CSA?</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionLabel}>This week</Text>
          <PostGrid posts={posts} />
          {posts.length === 0 && <Text style={styles.empty}>Nothing happening this week.</Text>}
        </View>
      </ScrollView>
      {popup && showPopup && <PromoPopup popup={popup} onClose={() => setShowPopup(false)} />}
      <InfoModal visible={showInfo} title="What is CSA?" body={WHAT_IS_CSA} onClose={() => setShowInfo(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.lg },
  body: { padding: spacing.lg, gap: spacing.md },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  quickActions: { flexDirection: 'row', gap: spacing.md },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.redSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    ...shadow.card,
  },
  quickActionText: { color: colors.redSoftText, fontWeight: '700', fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
