import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, useWindowDimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import PostCard from '../../src/components/PostCard';
import PostDetailModal from '../../src/components/PostDetailModal';
import { Post, PostType } from '../../src/types';
import { colors, radius, spacing, shadow } from '../../src/theme';
import { getEventWindow, formatEventTimeRange } from '../../src/utils';

// Single column on phones, more as the viewport widens (mainly for web,
// where one card stretched edge-to-edge on a desktop window looks broken).
function columnsForWidth(width: number) {
  if (width >= 1100) return 3;
  if (width >= 700) return 2;
  return 1;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

type DateFilter = 'upcoming' | 'week' | 'month' | 'all';
type TypeFilter = 'all' | PostType;

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All' },
];

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'event', label: 'Events' },
  { key: 'announcement', label: 'Announcements' },
  { key: 'collab', label: 'Collabs' },
];

// Posts with no dateTime (evergreen announcements, mainly) always pass —
// a date filter narrowing to "this week" shouldn't hide something that
// was never dated in the first place.
function matchesDateFilter(post: Post, filter: DateFilter, now: Date): boolean {
  const window = getEventWindow(post);
  if (!window || filter === 'all') return true;
  if (filter === 'upcoming') return window.end >= now;
  if (filter === 'week') return window.end >= now && window.start <= new Date(now.getTime() + WEEK_MS);
  return window.end >= now && window.start <= new Date(now.getTime() + MONTH_MS);
}

export default function EventsScreen() {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const columns = columnsForWidth(width);
  const [posts, setPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('upcoming');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const isMemberOrAbove = !!profile && profile.role !== 'user';

  const openDetail = (post: Post) => {
    setDetailPost(post);
    setShowDetail(true);
  };

  // Every post type lives here now, not just "event" — Home dropped its
  // general feed in favor of the full-bleed carousel, so this is the only
  // place announcements/collabs are browsable at all, alongside events.
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
      setPosts(all.filter((p) => p.visibility === 'everyone' || isMemberOrAbove));
    });
    return unsub;
  }, [isMemberOrAbove]);

  const now = new Date();
  const filtered = posts.filter(
    (p) => (typeFilter === 'all' || p.type === typeFilter) && matchesDateFilter(p, dateFilter, now)
  );
  // Dated posts sort soonest-first; undated ones (no dateTime) trail behind
  // in their already-fetched createdAt-desc order, since there's no date
  // to sort them by.
  const dated = filtered.filter((p) => p.dateTime).sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime());
  const undated = filtered.filter((p) => !p.dateTime);
  const visiblePosts = [...dated, ...undated];

  const query_ = search.trim().toLowerCase();
  // Search operates within the current filters rather than the full list,
  // so "Announcements" + a search term compose instead of the search
  // silently ignoring the type/date filters already chosen.
  const searchResults = query_ ? visiblePosts.filter((p) => p.title.toLowerCase().includes(query_)) : [];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Events</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {DATE_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, dateFilter === f.key && styles.filterChipActive]}
            onPress={() => setDateFilter(f.key)}
          >
            <Text style={[styles.filterChipText, dateFilter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.filterRow}>
        {TYPE_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, typeFilter === f.key && styles.filterChipActive]}
            onPress={() => setTypeFilter(f.key)}
          >
            <Text style={[styles.filterChipText, typeFilter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {query_ ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.resultRow} onPress={() => openDetail(item)}>
              <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.resultMeta}>{formatEventTimeRange(item.dateTime, item.endDateTime, item.allDay)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No results match "{search}".</Text>}
        />
      ) : (
        <FlatList
          key={columns}
          data={visiblePosts}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.row : undefined}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.cell, { width: `${100 / columns}%` }]}>
              <PostCard post={item} onPress={() => openDetail(item)} />
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
        />
      )}

      {detailPost && (
        <PostDetailModal post={detailPost} visible={showDetail} onClose={() => setShowDetail(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, padding: spacing.lg, paddingBottom: spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm, fontSize: 14, color: colors.textPrimary },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.red, borderColor: colors.red },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  filterChipTextActive: { color: colors.onAccent },
  resultRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  resultTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  resultMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  list: { gap: spacing.md, padding: spacing.lg },
  row: { marginHorizontal: -spacing.xs },
  cell: { padding: spacing.xs },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
});
