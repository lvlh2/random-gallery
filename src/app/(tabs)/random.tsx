import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { Colors } from "@/constants/theme";
import { fisherYatesShuffle } from "@/services/random";
import { getFolders } from "@/services/folders";
import { setViewerImages } from "@/services/viewer-state";
import type { ViewerImage } from "@/services/viewer-state";
import { getCachedImages, loadImages } from "@/services/media-loader";

const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get("window").width;
const ITEM_GAP = 2;
const PADDING = 2;
const ITEM_SIZE =
  (SCREEN_WIDTH - PADDING * 2 - ITEM_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export default function RandomScreen() {
  const [images, setImages] = useState<ViewerImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const gridKey = useRef(0);

  useFocusEffect(
    useCallback(() => {
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

          // Use cached results if available; otherwise do a full load
          const cached = getCachedImages();
          let allImages: ViewerImage[];
          if (cached !== null) {
            allImages = cached;
            setLoading(false); // instant — no I/O
          } else {
            allImages = await loadImages(folders);
            if (!cancelled) setLoading(false);
          }

          if (!cancelled) {
            const shuffled = fisherYatesShuffle(allImages);
            setImages(shuffled);
            setViewerImages(shuffled);
            gridKey.current++;
          }
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

  function renderItem({ item, index }: { item: ViewerImage; index: number }) {
    return (
      <Pressable
        onPress={() => router.push(`/viewer?index=${index}`)}
        style={({ pressed }) => [
          styles.gridItem,
          pressed && styles.gridItemPressed,
        ]}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnail}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={item.uri}
          transition={200}
        />
      </Pressable>
    );
  }

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

  // --- grid ---
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Count header */}
      <ThemedView style={styles.header}>
        <ThemedText themeColor="textSecondary" type="small">
          {images.length} {images.length === 1 ? "image" : "images"}
        </ThemedText>
      </ThemedView>

      <FlatList
        key={gridKey.current}
        data={images}
        keyExtractor={(item) => item.uri}
        renderItem={renderItem}
        numColumns={NUM_COLUMNS}
        windowSize={7}
        maxToRenderPerBatch={21}
        initialNumToRender={21}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.columnWrapper}
        getItemLayout={(_, index) => ({
          length: ITEM_SIZE,
          offset: ITEM_SIZE * Math.floor(index / NUM_COLUMNS),
          index,
        })}
      />
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
  header: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: "center",
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
  gridContent: {
    paddingHorizontal: PADDING,
    paddingBottom: BottomTabInset + Spacing.two,
  },
  columnWrapper: { gap: ITEM_GAP, marginBottom: ITEM_GAP },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: Colors.dark.backgroundElement,
  },
  gridItemPressed: { opacity: 0.8 },
  thumbnail: { width: "100%", height: "100%" },
});
