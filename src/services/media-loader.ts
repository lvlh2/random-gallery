import { Platform, AppState } from "react-native";
import { isImageFile } from "@/services/image-utils";
import type { ViewerImage } from "@/services/viewer-state";
import type { FolderImport } from "@/services/folders";

// SAF (Android-only, used as fallback)
let StorageAccessFramework: any = null;
if (Platform.OS === "android") {
  const SAF = require("expo-file-system/legacy");
  StorageAccessFramework = SAF.StorageAccessFramework;
}

// MediaLibrary (Android-only)
let MediaLibrary: any = null;
if (Platform.OS === "android") {
  MediaLibrary = require("expo-media-library/legacy");
}

// ---- In-memory cache ----

let _cachedImages: ViewerImage[] | null = null;
let _lastAppState = AppState.currentState;

/** Listen for app returning from background to trigger re-scan. */
AppState.addEventListener("change", (nextState) => {
  if (_lastAppState.match(/inactive|background/) && nextState === "active") {
    _cachedImages = null; // invalidate cache on return from background
  }
  _lastAppState = nextState;
});

/** Return cached images without I/O. */
export function getCachedImages(): ViewerImage[] | null {
  return _cachedImages;
}

/** Invalidate cache — call after folder list changes. */
export function invalidateCache(): void {
  _cachedImages = null;
}

/** Load all images — uses MediaStore when possible, SAF as fallback. */
export async function loadImages(
  folders: FolderImport[],
): Promise<ViewerImage[]> {
  const enabled = folders.filter((f) => f.enabled);
  if (enabled.length === 0) {
    _cachedImages = [];
    return [];
  }

  const results: ViewerImage[] = [];

  if (MediaLibrary) {
    try {
      const albums = await MediaLibrary.getAlbumsAsync();

      // Query each enabled folder's album in parallel
      const folderResults = await Promise.allSettled(
        enabled.map(async (folder) => {
          const album = albums.find((a: any) => a.title === folder.name);
          if (album) {
            const {
              assets,
            }: { assets: Array<{ uri: string; filename: string }> } =
              await MediaLibrary.getAssetsAsync({
                album,
                first: 99999,
                mediaType: "photo",
              });
            return assets.map((a) => ({ uri: a.uri, name: a.filename }));
          }
          // Fallback: SAF scan for this folder
          if (!StorageAccessFramework) return [];
          const files = await StorageAccessFramework.readDirectoryAsync(
            folder.uri,
          );
          return files
            .filter((u: string) => isImageFile(u))
            .map((u: string) => ({ uri: u, name: u.split("/").pop() || u }));
        }),
      );

      for (const r of folderResults) {
        if (r.status === "fulfilled") results.push(...r.value);
      }
    } catch {
      // MediaStore failed entirely → fallback to SAF
      return loadViaSAF(enabled);
    }
  } else {
    // No MediaLibrary (web/iOS) → SAF or empty
    return loadViaSAF(enabled);
  }

  _cachedImages = results;
  return results;
}

/** Full SAF-based loading as fallback. */
async function loadViaSAF(folders: FolderImport[]): Promise<ViewerImage[]> {
  if (!StorageAccessFramework) return [];
  const results: ViewerImage[] = [];
  const folderResults = await Promise.allSettled(
    folders.map(async (folder) => {
      const files = await StorageAccessFramework.readDirectoryAsync(folder.uri);
      return files
        .filter((u: string) => isImageFile(u))
        .map((u: string) => ({ uri: u, name: u.split("/").pop() || u }));
    }),
  );
  for (const r of folderResults) {
    if (r.status === "fulfilled") results.push(...r.value);
  }
  _cachedImages = results;
  return results;
}
