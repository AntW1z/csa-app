import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, useWindowDimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, DateData } from 'react-native-calendars';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import PostCard from '../../src/components/PostCard';
import { Post } from '../../src/types';
import { colors, radius, spacing, shadow } from '../../src/theme';
import { getEventWindow, toDateString, formatEventTimeRange } from '../../src/utils';

// Single column on phones, more as the viewport widens (mainly for web,
// where one card stretched edge-to-edge on a desktop window looks broken).
function columnsForWidth(width: number) {
  if (width >= 1100) return 3;
  if (width >= 700) return 2;
  return 1;
}

export default function CalendarScreen() {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const columns = columnsForWidth(width);
  const [events, setEvents] = useState<Post[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const isMemberOrAbove = !!profile && profile.role !== 'user';

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('type', '==', 'event'), orderBy('dateTime', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
      setEvents(all.filter((p) => p.visibility === 'everyone' || isMemberOrAbove));
    });
    return unsub;
  }, [isMemberOrAbove]);

  // A dot on every day an event covers, plus a highlight on whichever day
  // is currently selected as the filter.
  const markedDates: Record<string, any> = (() => {
    const marks: Record<string, any> = {};
    events.forEach((event) => {
      const window = getEventWindow(event);
      if (!window) return;
      const cur = new Date(window.start.getFullYear(), window.start.getMonth(), window.start.getDate());
      const last = new Date(window.end.getFullYear(), window.end.getMonth(), window.end.getDate());
      while (cur <= last) {
        const dStr = toDateString(cur);
        marks[dStr] = { ...marks[dStr], marked: true, dotColor: colors.red };
        cur.setDate(cur.getDate() + 1);
      }
    });
    if (selectedDate) {
      marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: colors.red };
    }
    return marks;
  })();

  // No date selected: just show the calendar, no list underneath.
  const visibleEvents = selectedDate
    ? events.filter((event) => {
        const window = getEventWindow(event);
        if (!window) return false;
        return toDateString(window.start) <= selectedDate && selectedDate <= toDateString(window.end);
      })
    : [];

  const query_ = search.trim().toLowerCase();
  const searchResults = query_ ? events.filter((e) => e.title.toLowerCase().includes(query_)) : [];

  const jumpToEvent = (event: Post) => {
    const window = getEventWindow(event);
    if (!window) return;
    const dStr = toDateString(window.start);
    setSelectedDate(dStr);
    setVisibleMonth(dStr);
    setSearch('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Calendar</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events by title"
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

      {query_ ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.resultRow} onPress={() => jumpToEvent(item)}>
              <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.resultMeta}>{formatEventTimeRange(item.dateTime, item.endDateTime, item.allDay)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No events match "{search}".</Text>}
        />
      ) : (
        <>
          <View style={styles.calendarWrap}>
            <Calendar
              current={visibleMonth}
              onDayPress={(day: DateData) => setSelectedDate((prev) => (prev === day.dateString ? null : day.dateString))}
              onMonthChange={(month: DateData) => setVisibleMonth(month.dateString)}
              markedDates={markedDates}
              theme={{ todayTextColor: colors.red, arrowColor: colors.red, selectedDayBackgroundColor: colors.red, dotColor: colors.red }}
            />
          </View>
          {selectedDate && (
            <FlatList
              key={columns}
              data={visibleEvents}
              keyExtractor={(item) => item.id}
              numColumns={columns}
              columnWrapperStyle={columns > 1 ? styles.row : undefined}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <View style={[styles.cell, { width: `${100 / columns}%` }]}>
                  <PostCard post={item} />
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No events on this day.</Text>}
            />
          )}
        </>
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
  calendarWrap: {
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
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
