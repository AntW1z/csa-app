import { useEffect, useRef, useState } from 'react';
import { View, Image, Pressable, FlatList, StyleSheet, Dimensions } from 'react-native';
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
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % items.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
        onMomentumScrollEnd={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPressItem(item)} disabled={!item.postId}>
            {/* "contain" so a tall poster shows in full (letterboxed) instead
                of "cover" cropping it to fill this short, wide strip. */}
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
  wrap: { width: '100%', height: HEIGHT },
  image: { width: SCREEN_WIDTH, height: HEIGHT, backgroundColor: colors.surfaceMuted },
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
