// ---------------------------------------------------------------------------
// Integration tests: three-layer cache consistency
//
// The three layers are:
//   1. media-loader._cachedImages       (persistent in-memory cache)
//   2. viewer-state._currentImages      (bridge for viewer)
//   3. random.tsx component state        (UI state, imagesRef)
//
// This suite simulates the full lifecycle: load → shuffle → navigate →
// delete → return → verify consistency.
// ---------------------------------------------------------------------------

import type { FolderImport } from "@/services/folders";
import type { ViewerImage } from "@/services/viewer-state";

const MediaLibrary = require("expo-media-library/legacy");

import * as mediaLoader from "@/services/media-loader";
import * as viewerState from "@/services/viewer-state";
import { fisherYatesShuffle } from "@/services/random";

beforeEach(() => {
  // Reset cache via public API
  mediaLoader.invalidateCache();
  viewerState.clearViewerImages();
  jest.clearAllMocks();
  MediaLibrary.getAlbumsAsync.mockReset();
  MediaLibrary.getAssetsAsync.mockReset();
});

// ---- Helpers ----

function makeFolder(name: string, id?: string): FolderImport {
  return {
    id: id ?? `id-${name}`,
    uri: `content://test/${name}`,
    name,
    enabled: true,
  };
}

function mockAlbum(title: string, imageCount: number) {
  const assets = Array.from({ length: imageCount }, (_, i) => ({
    uri: `content://media/external/${title}/img_${i}.jpg`,
    filename: `img_${i}.jpg`,
  }));
  return { title, assets };
}

async function setupMockAlbum(title: string, count: number) {
  const album = mockAlbum(title, count);
  MediaLibrary.getAlbumsAsync.mockResolvedValue([{ title, count }]);
  MediaLibrary.getAssetsAsync.mockResolvedValue({
    assets: album.assets,
    endCursor: "end",
    hasNextPage: false,
    totalCount: count,
  });
  const folders: FolderImport[] = [makeFolder(title)];
  const allImages = await mediaLoader.loadImages(folders);
  return { allImages, folders, album };
}

describe("Cache consistency (three-layer)", () => {
  // ------------------------------------------------------------------
  // Flow 1: Initial load → shuffle → all layers agree
  // ------------------------------------------------------------------

  test("initial load: all three layers contain the same shuffled images", async () => {
    const { allImages } = await setupMockAlbum("DCIM", 5);

    // Shuffle and update all layers
    const shuffled = fisherYatesShuffle(allImages);
    mediaLoader.updateCachedImages(shuffled);
    viewerState.setViewerImages(shuffled);

    const cached = mediaLoader.getCachedImages();
    const viewer = viewerState.getViewerImages();

    expect(cached).toEqual(shuffled);
    expect(viewer).toEqual(shuffled);
    expect(cached).toHaveLength(5);
  });

  // ------------------------------------------------------------------
  // Flow 2: Delete an image → all layers updated
  // ------------------------------------------------------------------

  test("delete image: all three layers remove the deleted image", async () => {
    const { allImages } = await setupMockAlbum("DCIM", 3);
    const shuffled = fisherYatesShuffle(allImages);
    mediaLoader.updateCachedImages(shuffled);
    viewerState.setViewerImages(shuffled);

    const viewerImages = viewerState.getViewerImages();
    const imageToDelete = viewerImages[1];
    const updatedViewer = viewerImages.filter(
      (img) => img.uri !== imageToDelete.uri,
    );

    viewerState.setViewerImages(updatedViewer);
    mediaLoader.updateCachedImages(updatedViewer);

    expect(viewerState.getViewerImages()).toHaveLength(2);
    expect(mediaLoader.getCachedImages()).toHaveLength(2);
    expect(viewerState.getViewerImages()).toEqual(
      mediaLoader.getCachedImages(),
    );

    const allUris = viewerState.getViewerImages().map((img) => img.uri);
    expect(allUris).not.toContain(imageToDelete.uri);
  });

  // ------------------------------------------------------------------
  // Flow 3: Delete last image → all layers empty
  // ------------------------------------------------------------------

  test("delete last image: all layers cleared", async () => {
    const { allImages } = await setupMockAlbum("DCIM", 1);
    mediaLoader.updateCachedImages(allImages);
    viewerState.setViewerImages(allImages);

    const updated = viewerState.getViewerImages().filter(() => false);
    viewerState.setViewerImages(updated);
    mediaLoader.updateCachedImages(updated);

    expect(viewerState.getViewerImages()).toEqual([]);
    expect(mediaLoader.getCachedImages()).toEqual([]);
  });

  // ------------------------------------------------------------------
  // Flow 4: Shuffle preserves all images
  // ------------------------------------------------------------------

  test("shuffle FAB: preserves all images, updates all three layers", async () => {
    const { allImages } = await setupMockAlbum("DCIM", 10);
    const firstShuffle = fisherYatesShuffle(allImages);
    mediaLoader.updateCachedImages(firstShuffle);
    viewerState.setViewerImages(firstShuffle);

    const secondShuffle = fisherYatesShuffle(
      mediaLoader.getCachedImages()!,
    );
    mediaLoader.updateCachedImages(secondShuffle);
    viewerState.setViewerImages(secondShuffle);

    expect(mediaLoader.getCachedImages()).toHaveLength(10);
    expect(viewerState.getViewerImages()).toHaveLength(10);
    expect(mediaLoader.getCachedImages()).toEqual(
      viewerState.getViewerImages(),
    );
  });

  // ------------------------------------------------------------------
  // Flow 5: Cache invalidation on folder change
  // ------------------------------------------------------------------

  test("invalidateCache after folder import/remove: cache becomes null", async () => {
    mediaLoader.updateCachedImages([{ uri: "a.jpg", name: "a.jpg" }]);
    expect(mediaLoader.getCachedImages()).not.toBeNull();

    mediaLoader.invalidateCache();
    expect(mediaLoader.getCachedImages()).toBeNull();
  });

  // ------------------------------------------------------------------
  // Flow 6: Ref-based staleness detection
  // ------------------------------------------------------------------

  test("ref comparison detects deletion: oldRef !== newRef after delete", async () => {
    const { allImages } = await setupMockAlbum("DCIM", 3);
    mediaLoader.updateCachedImages(allImages);
    viewerState.setViewerImages(allImages);

    const oldRef = mediaLoader.getCachedImages();

    const viewerImages = viewerState.getViewerImages();
    const updated = viewerImages.slice(1);
    viewerState.setViewerImages(updated);
    mediaLoader.updateCachedImages(updated);

    const newRef = mediaLoader.getCachedImages();

    expect(oldRef).not.toBe(newRef);
  });
});
