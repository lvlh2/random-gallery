import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  ViewToken,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import {
  getViewerImages,
  setViewerImages,
  clearViewerImages,
} from "@/services/viewer-state";
import type { ViewerImage } from "@/services/viewer-state";
import { updateCachedImages } from "@/services/media-loader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ViewerScreen() {
  const { index } = useLocalSearchParams<{ index: string }>();
  const initialImages = getViewerImages();
  const initialIndex = parseInt(index || "0", 10) || 0;

  const [images, setImages] = useState<ViewerImage[]>(initialImages);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const flatListRef = useRef<FlatList<ViewerImage>>(null);

  // Guard: navigate back (deferred after render)
  useEffect(() => {
    if (initialImages.length === 0 || initialIndex >= initialImages.length) {
      router.back();
    }
  }, [initialImages, initialIndex]);

  const handleDelete = useCallback(() => {
    const target = images[currentIndex];
    if (!target) return;

    try {
      const FileSystem = require("expo-file-system/legacy");
      FileSystem.deleteAsync(target.uri, { idempotent: true }).catch(() => {});
    } catch {
      // Best-effort deletion
    }

    const updated = [...images];
    updated.splice(currentIndex, 1);

    if (updated.length === 0) {
      setImages([]);
      setViewerImages([]);
      updateCachedImages([]);
      clearViewerImages();
      router.back();
      return;
    }

    const newIndex =
      currentIndex >= updated.length ? updated.length - 1 : currentIndex;

    setImages(updated);
    setViewerImages(updated);
    updateCachedImages(updated);
    setCurrentIndex(newIndex);

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({
        index: newIndex,
        animated: false,
      });
    });
  }, [currentIndex, images]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlatList
        ref={flatListRef}
        data={images}
        horizontal
        pagingEnabled
        scrollEnabled={!isZoomed}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        getItemLayout={(_, idx) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * idx,
          index: idx,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item) => item.uri}
        renderItem={({ item }) => (
          <ImageItem
            item={item}
            isZoomed={isZoomed}
            onDeleteRequest={() => setShowConfirm(true)}
            onExitRequest={() => router.back()}
            onZoomChange={setIsZoomed}
          />
        )}
      />

      {showConfirm && (
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <ThemedText style={styles.warningIcon}>⚠️</ThemedText>
            <ThemedText style={styles.confirmTitle}>
              Delete this image?
            </ThemedText>
            <ThemedText
              themeColor="textSecondary"
              type="small"
              style={styles.confirmDesc}
            >
              This permanently deletes the file. This action cannot be undone.
            </ThemedText>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setShowConfirm(false)}
                style={styles.cancelButton}
              >
                <ThemedText>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowConfirm(false);
                  handleDelete();
                }}
                style={styles.deleteButton}
              >
                <ThemedText style={styles.deleteText}>Delete</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---- Per-image component with gestures ----

function ImageItem({
  item,
  isZoomed,
  onDeleteRequest,
  onExitRequest,
  onZoomChange,
}: {
  item: ViewerImage;
  isZoomed: boolean;
  onDeleteRequest: () => void;
  onExitRequest: () => void;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // Accumulated offsets so each pan continues from where the last one left off
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          savedScale.value = scale.value;
        })
        .onUpdate((e) => {
          scale.value = Math.max(0.5, savedScale.value * e.scale);
        })
        .onEnd(() => {
          if (scale.value < 1) {
            scale.value = withSpring(1);
            savedScale.value = 1;
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
            runOnJS(onZoomChange)(false);
          } else {
            savedScale.value = scale.value;
            runOnJS(onZoomChange)(true);
          }
        }),
    // Shared values are stable refs, callbacks captured at creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const panGesture = useMemo(() => {
    if (isZoomed) {
      // Zoomed: free pan in both axes to explore the enlarged image.
      return Gesture.Pan()
        .maxPointers(1)
        .onStart(() => {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        })
        .onUpdate((e) => {
          const extraW = ((savedScale.value - 1) * SCREEN_WIDTH) / 2;
          const extraH = ((savedScale.value - 1) * SCREEN_HEIGHT) / 2;
          translateX.value = Math.min(
            extraW,
            Math.max(-extraW, savedTranslateX.value + e.translationX),
          );
          translateY.value = Math.min(
            extraH,
            Math.max(-extraH, savedTranslateY.value + e.translationY),
          );
        });
    }

    // Normal: vertical only (delete / exit). Horizontal → FlatList.
    return Gesture.Pan()
      .activeOffsetY([-50, 50])
      .failOffsetX([-20, 20])
      .maxPointers(1)
      .onUpdate((e) => {
        translateY.value = e.translationY;
      })
      .onEnd((e) => {
        if (e.translationY < -120) {
          runOnJS(onDeleteRequest)();
        } else if (e.translationY > 120) {
          runOnJS(onExitRequest)();
        }
        translateY.value = withSpring(0);
      });
    // Re-created only when zoom state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isZoomed]);

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(pinchGesture, panGesture),
    [pinchGesture, panGesture],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.imagePage}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.animatedContainer, animatedStyle]}>
          <Image
            source={{ uri: item.uri }}
            style={styles.fullImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey={item.uri}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ---- styles ----

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  imagePage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  animatedContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.85,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBox: {
    marginHorizontal: Spacing.five,
    padding: Spacing.five,
    borderRadius: 16,
    backgroundColor: "#1c1c1e",
    alignItems: "center",
    gap: Spacing.two,
    width: SCREEN_WIDTH * 0.78,
  },
  warningIcon: {
    fontSize: 36,
    lineHeight: 48,
    marginBottom: Spacing.one,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  confirmDesc: {
    textAlign: "center",
    marginBottom: Spacing.one,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.two,
    alignSelf: "stretch",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  deleteButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#d32f2f",
  },
  deleteText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
