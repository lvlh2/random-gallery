import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { Colors } from "@/constants/theme";
import { fisherYatesShuffle } from "@/services/random";
import { getFolders } from "@/services/folders";
import { setViewerImages } from "@/services/viewer-state";
import type { ViewerImage } from "@/services/viewer-state";
import {
  getCachedImages,
  loadImages,
  updateCachedImages,
} from "@/services/media-loader";

const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const ITEM_GAP = 2;
const PADDING = 2;
const ITEM_SIZE =
  (SCREEN_WIDTH - PADDING * 2 - ITEM_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const ROWS_PER_PAGE = Math.max(
  4,
  Math.floor((SCREEN_HEIGHT - BottomTabInset) / (ITEM_SIZE + ITEM_GAP)),
);
const PAGE_SIZE = NUM_COLUMNS * ROWS_PER_PAGE;
const PAGE_HEIGHT = ROWS_PER_PAGE * (ITEM_SIZE + ITEM_GAP) - ITEM_GAP;

export default function RandomScreen() {
  const initCache = getCachedImages();
  const [images, setImages] = useState<ViewerImage[]>(initCache ?? []);
  const [loading, setLoading] = useState(initCache === null);
  const [error, setError] = useState<string | null>(null);
  const gridKey = useRef(0);
  const loadedOnce = useRef(initCache !== null);
  const imagesRef = useRef(initCache);

  useFocusEffect(
    useCallback(() => {
      // Sync state from cache (may have been updated by viewer deletions)
      const cached = getCachedImages();
      if (cached !== null && cached !== imagesRef.current) {
        imagesRef.current = cached;
        setImages(cached);
        setViewerImages(cached);
      }

      // Cache valid & already loaded — skip full reload
      if (loadedOnce.current && cached !== null) return;

      let cancelled = false;
      async function load() {
        setError(null);
        try {
          const folders = await getFolders();
          const enabled = folders.filter((f) => f.enabled);
          if (enabled.length === 0) {
            if (!cancelled) {
              setImages([]);
              setViewerImages([]);
            }
            setLoading(false);
            return;
          }

          // Need fresh load
          if (getCachedImages() === null) {
            const allImages = await loadImages(folders);
            if (cancelled) return;
            const shuffled = fisherYatesShuffle(allImages);
            updateCachedImages(shuffled);
            imagesRef.current = shuffled;
            setImages(shuffled);
            setViewerImages(shuffled);
            gridKey.current++;
          }
          loadedOnce.current = true;
          setLoading(false);
        } catch (e: any) {
          if (!cancelled) {
            setError(e.message);
            setLoading(false);
          }
        }
      }
      load();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  function handleRefresh() {
    const shuffled = fisherYatesShuffle(images);
    imagesRef.current = shuffled;
    setImages(shuffled);
    setViewerImages(shuffled);
    updateCachedImages(shuffled);
    gridKey.current++;
  }

  // Split shuffled images into vertical pages (each = one screen of thumbnail grid)
  const pages = useMemo(() => {
    const result: ViewerImage[][] = [];
    for (let i = 0; i < images.length; i += PAGE_SIZE) {
      result.push(images.slice(i, i + PAGE_SIZE));
    }
    return result;
  }, [images]);

  // --- loading ---
  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </SafeAreaView>
    );
  }

  // --- error ---
  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <ThemedText themeColor="textSecondary">{error}</ThemedText>
      </SafeAreaView>
    );
  }

  // --- empty ---
  if (images.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Animated.View entering={FadeInDown} style={styles.emptyContent}>
          <ThemedText type="title" style={styles.emptyIcon}>
            🖼️
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyTitle}>
            No images to show
          </ThemedText>
          <ThemedText
            themeColor="textSecondary"
            type="small"
            style={styles.emptyDesc}
          >
            Import a folder in the Folders tab to start browsing.
          </ThemedText>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // --- paged vertical grid ---
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <FlatList
        key={gridKey.current}
        data={pages}
        showsVerticalScrollIndicator={false}
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={1}
        getItemLayout={(_, idx) => ({
          length: PAGE_HEIGHT,
          offset: PAGE_HEIGHT * idx,
          index: idx,
        })}
        keyExtractor={(_, idx) => `p${idx}`}
        renderItem={({ item: pageImages, index: pi }) => (
          <View style={[styles.page, { height: PAGE_HEIGHT }]}>
            {pageImages.map((img, i) => {
              const globalIndex = pi * PAGE_SIZE + i;
              return (
                <Pressable
                  key={img.uri}
                  onPress={() => router.push(`/viewer?index=${globalIndex}`)}
                  style={({ pressed }) => [
                    styles.gridItem,
                    pressed && styles.gridItemPressed,
                  ]}
                >
                  <Image
                    source={{ uri: img.uri }}
                    style={styles.thumbnail}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    recyclingKey={img.uri}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      />

      {/* Shuffle FAB */}
      <Pressable
        onPress={handleRefresh}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <ThemedText style={styles.fabText}>↻</ThemedText>
      </Pressable>
    </SafeAreaView>
  );
}

// ---- styles ----

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  center: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.five,
  },
  emptyContent: {
    alignItems: "center",
    gap: Spacing.two,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptyDesc: {
    textAlign: "center",
    lineHeight: 20,
  },
  page: {
    width: SCREEN_WIDTH,
    paddingHorizontal: PADDING,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: ITEM_GAP,
    alignContent: "flex-start",
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: Colors.dark.backgroundElement,
  },
  gridItemPressed: { opacity: 0.8 },
  thumbnail: { width: "100%", height: "100%" },
  fab: {
    position: "absolute",
    bottom: BottomTabInset + Spacing.three,
    right: Spacing.four,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.dark.backgroundElement,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  fabPressed: { opacity: 0.7 },
  fabText: {
    fontSize: 30,
    paddingBottom: 8,
    color: Colors.dark.text,
    textAlign: "center",
  },
});
