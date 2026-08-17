import { useEffect, useRef, useState } from 'react';
import { View, Image, Pressable, FlatList, StyleSheet, Dimensions, Animated } from 'react-native';
import { CarouselItem } from '../types';
import { colors, spacing } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEIGHT = 320;
const AUTO_ADVANCE_MS = 4000;

// What happens on tap (open a post's detail, or nothing for a plain image)
// is decided by the caller, since a post-linked item needs a Firestore
// fetch that only Home has the context to do.
export default function PromoCarousel({ items, onPressItem }: { items: CarouselItem[]; onPressItem: (item: CarouselItem) => void }) {
  const listRef = useRef<FlatList<CarouselItem>>(null);
  // Index into the *real* items array, not the padded one below — dots and
  // the auto-advance target both stay in this space so nothing else needs
  // to know the padding exists.
  const [activeIndex, setActiveIndex] = useState(0);
  // Drives the currently-active progress bar's fill — a single shared
  // value, not one per item, since only ever one segment is animating at
  // a time. Segments before/after activeIndex just render statically full
  // or empty (see the bars below), so this only needs to represent "how
  // far through the current one are we."
  const progress = useRef(new Animated.Value(0)).current;

  // A clone of the last item up front and the first item at the end, so a
  // manual swipe past either edge lands on a look-alike neighbor instead of
  // just stopping — see onMomentumScrollEnd, which silently snaps that
  // clone back to the real item at the same position, making it read as an
  // infinite loop. Real items sit at padded index i+1.
  const loopedItems = items.length > 1 ? [items[items.length - 1], ...items, items[0]] : items;

  const scrollToReal = (realIndex: number, animated: boolean) => {
    listRef.current?.scrollToIndex({ index: items.length > 1 ? realIndex + 1 : realIndex, animated });
  };

  // Re-armed on every activeIndex change — whatever caused that change
  // (auto-advance firing, or the user manually swiping) gets a full fresh
  // AUTO_ADVANCE_MS before the next auto-advance, instead of the old timer
  // (which ran on its own fixed schedule) potentially firing again just
  // moments after a manual swipe and making the whole thing feel frantic.
  // Only triggers the scroll — activeIndex itself is always updated by
  // onMomentumScrollEnd once it lands, whether that scroll was user-driven
  // or this timer, so there's a single source of truth for it.
  useEffect(() => {
    if (items.length < 2) return;
    progress.setValue(0);
    const fill = Animated.timing(progress, {
      toValue: 1,
      duration: AUTO_ADVANCE_MS,
      useNativeDriver: false, // animating width, which the native driver can't handle
    });
    fill.start();
    const timer = setTimeout(() => {
      // Always just one padded slot forward — when that's the trailing
      // clone of the first item, onMomentumScrollEnd's existing wrap
      // handling snaps it to the real one, so this animates forward
      // through the clone instead of jumping backward across the list.
      listRef.current?.scrollToIndex({ index: activeIndex + 2, animated: true });
    }, AUTO_ADVANCE_MS);
    return () => { clearTimeout(timer); fill.stop(); };
  }, [items.length, activeIndex]);

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={loopedItems}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={items.length > 1 ? 1 : 0}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
        onMomentumScrollEnd={(e) => {
          const rawIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          if (items.length > 1 && rawIndex === 0) {
            // Landed on the leading clone of the last item — snap to the
            // real one at the same visual position, no animation so it's
            // an invisible swap rather than a second scroll.
            scrollToReal(items.length - 1, false);
            setActiveIndex(items.length - 1);
          } else if (items.length > 1 && rawIndex === loopedItems.length - 1) {
            scrollToReal(0, false);
            setActiveIndex(0);
          } else {
            setActiveIndex(items.length > 1 ? rawIndex - 1 : rawIndex);
          }
        }}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPressItem(item)} disabled={!item.postId}>
            {/* "contain" so a tall poster shows in full (letterboxed) instead
                of "cover" cropping it to fill this short, wide strip. */}
            <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="contain" />
          </Pressable>
        )}
      />
      {items.length > 1 && (
        <View style={styles.bars}>
          {items.map((item, i) => (
            <View key={item.id} style={styles.barTrack}>
              <Animated.View
                style={[
                  styles.barFill,
                  i < activeIndex && { width: '100%' },
                  i > activeIndex && { width: '0%' },
                  i === activeIndex && { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: HEIGHT },
  image: { width: SCREEN_WIDTH, height: HEIGHT, backgroundColor: colors.surfaceMuted },
  bars: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: 4,
  },
  barTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.onAccent },
});
