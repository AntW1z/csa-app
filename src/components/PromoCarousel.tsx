import { useEffect, useRef, useState } from 'react';
import { View, Image, Pressable, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { CarouselItem } from '../types';
import { colors, spacing } from '../theme';

const AUTO_ADVANCE_MS = 4000;

// What happens on tap (open a post's detail, or nothing for a plain image)
// is decided by the caller, since a post-linked item needs a Firestore
// fetch that only Home has the context to do.
export default function PromoCarousel({ items, onPressItem }: { items: CarouselItem[]; onPressItem: (item: CarouselItem) => void }) {
  // A reactive hook, not a one-time Dimensions.get() snapshot — on web
  // especially, the window can be a different size than whatever it read
  // at module-load time (or resize later), which would silently desync
  // this from the FlatList's actual rendered slide width and break paging.
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const listRef = useRef<FlatList<CarouselItem>>(null);
  // Index into the *real* items array, not the padded one below — dots and
  // the auto-advance target both stay in this space so nothing else needs
  // to know the padding exists.
  const [activeIndex, setActiveIndex] = useState(0);

  // A clone of the last item up front and the first item at the end, so a
  // manual swipe past either edge lands on a look-alike neighbor instead of
  // just stopping — see onMomentumScrollEnd, which silently snaps that
  // clone back to the real item at the same position, making it read as an
  // infinite loop. Real items sit at padded index i+1.
  const loopedItems = items.length > 1 ? [items[items.length - 1], ...items, items[0]] : items;

  const scrollToReal = (realIndex: number, animated: boolean) => {
    listRef.current?.scrollToIndex({ index: items.length > 1 ? realIndex + 1 : realIndex, animated });
  };

  // FlatList's initialScrollIndex prop is unreliable on react-native-web
  // specifically (it scrolls before layout has settled, which browsers
  // don't handle consistently) — it always worked on iOS but silently
  // failed on web, leaving the list positioned nowhere near any real
  // content. Doing the initial position explicitly via the same
  // scrollToIndex already used elsewhere here is far more reliable, and
  // the ref guard keeps it from re-firing (and yanking an in-progress
  // viewer back to the start) if the item count just changes later.
  const hasSetInitialScroll = useRef(false);
  useEffect(() => {
    if (hasSetInitialScroll.current || items.length <= 1) return;
    hasSetInitialScroll.current = true;
    listRef.current?.scrollToIndex({ index: 1, animated: false });
  }, [items.length]);

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
    const timer = setTimeout(() => {
      // Always just one padded slot forward — when that's the trailing
      // clone of the first item, onMomentumScrollEnd's existing wrap
      // handling snaps it to the real one, so this animates forward
      // through the clone instead of jumping backward across the list.
      listRef.current?.scrollToIndex({ index: activeIndex + 2, animated: true });
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [items.length, activeIndex]);

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        style={styles.list}
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
          <Pressable style={[styles.slide, { width: SCREEN_WIDTH }]} onPress={() => onPressItem(item)} disabled={!item.postId}>
            {/* Blurred cover copy fills the screen edge-to-edge as a
                backdrop, with the real (uncropped) image "contain"-ed on
                top of it — full image always visible, no cropping, and no
                plain blank bars when its shape doesn't match the screen. */}
            <Image source={{ uri: item.imageUrl }} style={styles.bgImage} resizeMode="cover" blurRadius={25} />
            <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="contain" />
          </Pressable>
        )}
      />
      {items.length > 1 && (
        <View style={styles.dots}>
          {items.map((item, i) => (
            <View key={item.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', flex: 1 },
  list: { flex: 1 },
  slide: { height: '100%' },
  bgImage: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.surfaceMuted },
  image: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  dots: {
    position: 'absolute',
    bottom: spacing.sm,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotActive: { width: 16, backgroundColor: colors.onAccent },
});
