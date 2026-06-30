import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { runOnJS } from "react-native-reanimated";
import { Gallery } from "react-native-zoom-toolkit";
import type {
  GalleryRefType,
  VerticalPullOptions,
} from "react-native-zoom-toolkit";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import {
  getViewerImages,
  setViewerImages,
  clearViewerImages,
} from "@/services/viewer-state";
import type { ViewerImage } from "@/services/viewer-state";
import { updateCachedImages } from "@/services/media-loader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const DELETE_THRESHOLD = 120;

export default function ViewerScreen() {
  const { index } = useLocalSearchParams<{ index: string }>();
  const initialImages = getViewerImages();
  const initialIndex = parseInt(index || "0", 10) || 0;

  const [images, setImages] = useState<ViewerImage[]>(initialImages);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showConfirm, setShowConfirm] = useState(false);
  const galleryRef = useRef<GalleryRefType>(null);

  // Guard: navigate back if data is invalid
  useEffect(() => {
    if (initialImages.length === 0 || initialIndex >= initialImages.length) {
      router.replace("/random");
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
      setViewerImages([]);
      updateCachedImages([]);
      clearViewerImages();
      try {
        router.back();
      } catch {
        router.replace("/random");
      }
      return;
    }

    const newIndex =
      currentIndex >= updated.length ? updated.length - 1 : currentIndex;

    // Deleting the last item in the list: move Gallery to the previous
    // image programmatically before React updates the data. Without this,
    // Gallery's internal FlatList gets stuck when the tail item is removed.
    if (currentIndex === images.length - 1) {
      galleryRef.current?.setIndex(newIndex);
    }

    setImages(updated);
    setViewerImages(updated);
    updateCachedImages(updated);
    setCurrentIndex(newIndex);
  }, [currentIndex, images]);

  const exitingRef = useRef(false);

  // JS-thread targets — captured by the worklet via runOnJS
  const jsShowConfirm = useCallback(() => {
    if (exitingRef.current) return;
    setShowConfirm(true);
  }, []);
  const jsGoBack = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    try {
      router.back();
    } catch {
      router.replace("/random");
    }
  }, []);

  // Worklet: runs on UI thread, bridges to JS via runOnJS.
  // Called only when scale === 1 (Gallery guarantees this).
  const handleVerticalPull = (options: VerticalPullOptions) => {
    "worklet";
    if (options.released) {
      if (options.translateY < -DELETE_THRESHOLD) {
        runOnJS(jsShowConfirm)();
      } else if (options.translateY > DELETE_THRESHOLD) {
        runOnJS(jsGoBack)();
      }
    }
  };

  const renderImage = useCallback(
    (item: ViewerImage, _index: number) => (
      <View style={styles.imagePage}>
        <Image
          source={{ uri: item.uri }}
          style={styles.fullImage}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={item.uri}
        />
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback((item: ViewerImage) => item.uri, []);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <Gallery
        ref={galleryRef}
        data={images}
        renderItem={renderImage}
        keyExtractor={keyExtractor}
        initialIndex={initialIndex}
        windowSize={3}
        vertical={false}
        zoomEnabled
        allowPinchPanning
        scaleMode="bounce"
        pinchMode="clamp"
        onIndexChange={setCurrentIndex}
        onVerticalPull={handleVerticalPull}
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
                style={styles.deleteConfirmButton}
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
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.85,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
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
  deleteConfirmButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#d32f2f",
  },
  deleteText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
