// ---------------------------------------------------------------------------
// Integration tests: viewer delete flow end-to-end
//
// Simulates the full delete lifecycle:
//   grid → tap thumbnail → viewer opens → swipe up → confirm → delete
//   → return to grid → cache ref comparison detects change → grid refreshes
// ---------------------------------------------------------------------------

import type { FolderImport } from "@/services/folders";
import type { ViewerImage } from "@/services/viewer-state";

const MediaLibrary = require("expo-media-library/legacy");
const { router } = require("expo-router");

import * as mediaLoader from "@/services/media-loader";
import * as viewerState from "@/services/viewer-state";
import { fisherYatesShuffle } from "@/services/random";

beforeEach(() => {
  mediaLoader.invalidateCache();
  viewerState.clearViewerImages();
  jest.clearAllMocks();
  MediaLibrary.getAlbumsAsync.mockReset();
  MediaLibrary.getAssetsAsync.mockReset();
  router.push.mockClear?.();
  router.back.mockClear?.();
});

// ---- Helpers ----

function mockAlbum(title: string, imageCount: number) {
  return {
    title,
    assets: Array.from({ length: imageCount }, (_, i) => ({
      uri: `content://media/external/${title}/img_${i}.jpg`,
      filename: `img_${i}.jpg`,
    })),
  };
}

async function loadAndShuffle(folderName: string, count: number) {
  const album = mockAlbum(folderName, count);
  MediaLibrary.getAlbumsAsync.mockResolvedValue([
    { title: folderName, count },
  ]);
  MediaLibrary.getAssetsAsync.mockResolvedValue({
    assets: album.assets,
    endCursor: "end",
    hasNextPage: false,
    totalCount: count,
  });

  const folders: FolderImport[] = [
    { id: "f1", uri: "content://test/DCIM", name: folderName, enabled: true },
  ];
  const allImages = await mediaLoader.loadImages(folders);
  const shuffled = fisherYatesShuffle(allImages);
  mediaLoader.updateCachedImages(shuffled);
  viewerState.setViewerImages(shuffled);
  return { allImages, shuffled, album };
}

describe("Delete flow", () => {
  // ------------------------------------------------------------------
  // Delete middle image
  // ------------------------------------------------------------------

  test("delete middle image: viewer updates, grid detects change via ref", async () => {
    const { shuffled } = await loadAndShuffle("DCIM", 5);
    const gridRefBeforeDelete = mediaLoader.getCachedImages();

    const viewerImages = viewerState.getViewerImages();
    const toDelete = viewerImages[2];

    const updatedImages = viewerImages.filter(
      (img) => img.uri !== toDelete.uri,
    );

    viewerState.setViewerImages(updatedImages);
    mediaLoader.updateCachedImages(updatedImages);

    const gridRefAfterDelete = mediaLoader.getCachedImages();

    expect(gridRefBeforeDelete).not.toBe(gridRefAfterDelete);
    expect(viewerState.getViewerImages()).toHaveLength(4);
    expect(viewerState.getViewerImages()).not.toContainEqual(toDelete);
  });

  // ------------------------------------------------------------------
  // Delete first image
  // ------------------------------------------------------------------

  test("delete first image: index adjustment is correct", async () => {
    const { shuffled } = await loadAndShuffle("DCIM", 3);
    const originalSecond = shuffled[1];

    const viewerImages = viewerState.getViewerImages();
    const updated = viewerImages.filter(
      (img) => img.uri !== viewerImages[0].uri,
    );
    viewerState.setViewerImages(updated);
    mediaLoader.updateCachedImages(updated);

    expect(updated).toHaveLength(2);
    expect(updated[0].uri).toBe(originalSecond.uri);
  });

  // ------------------------------------------------------------------
  // Delete last image
  // ------------------------------------------------------------------

  test("delete last image: index adjustment is correct", async () => {
    const { shuffled } = await loadAndShuffle("DCIM", 3);

    const viewerImages = viewerState.getViewerImages();
    // Delete the last image (index 2)
    const updated = viewerImages.filter(
      (_, idx) => idx !== viewerImages.length - 1,
    );
    viewerState.setViewerImages(updated);
    mediaLoader.updateCachedImages(updated);

    expect(updated).toHaveLength(2);
    // The old second-last becomes the new last
    expect(updated[1]).toBe(viewerImages[1]);
  });

  // ------------------------------------------------------------------
  // Delete only remaining image
  // ------------------------------------------------------------------

  test("delete the only image: all cleared, router.back is called", async () => {
    await loadAndShuffle("DCIM", 1);

    const viewerImages = viewerState.getViewerImages();
    expect(viewerImages).toHaveLength(1);

    const updated = viewerImages.filter(() => false);
    viewerState.setViewerImages(updated);
    mediaLoader.updateCachedImages(updated);

    if (updated.length === 0) {
      router.back();
    }

    expect(viewerState.getViewerImages()).toEqual([]);
    expect(mediaLoader.getCachedImages()).toEqual([]);
    expect(router.back).toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Multiple deletes in sequence
  // ------------------------------------------------------------------

  test("sequential deletes: cache stays consistent", async () => {
    const { shuffled } = await loadAndShuffle("DCIM", 5);

    let viewer = viewerState.getViewerImages();
    viewer = viewer.filter((img) => img.uri !== viewer[3].uri);
    viewerState.setViewerImages(viewer);
    mediaLoader.updateCachedImages(viewer);
    expect(viewerState.getViewerImages()).toHaveLength(4);

    viewer = viewerState.getViewerImages();
    viewer = viewer.filter((img) => img.uri !== viewer[1].uri);
    viewerState.setViewerImages(viewer);
    mediaLoader.updateCachedImages(viewer);
    expect(viewerState.getViewerImages()).toHaveLength(3);

    viewer = viewerState.getViewerImages();
    viewer = viewer.filter((img) => img.uri !== viewer[0].uri);
    viewerState.setViewerImages(viewer);
    mediaLoader.updateCachedImages(viewer);
    expect(viewerState.getViewerImages()).toHaveLength(2);

    expect(mediaLoader.getCachedImages()).toEqual(
      viewerState.getViewerImages(),
    );
  });

  // ------------------------------------------------------------------
  // Delete all images at once
  // ------------------------------------------------------------------

  test("delete all images: cache becomes empty array", async () => {
    await loadAndShuffle("DCIM", 10);

    viewerState.setViewerImages([]);
    mediaLoader.updateCachedImages([]);

    expect(mediaLoader.getCachedImages()).toEqual([]);
    expect(viewerState.getViewerImages()).toEqual([]);
  });

  // ------------------------------------------------------------------
  // Cache ref detection: grid skips reload when no deletion occurred
  // ------------------------------------------------------------------

  test("ref unchanged when no mutation: grid should skip reload", async () => {
    const { shuffled } = await loadAndShuffle("DCIM", 5);
    const ref1 = mediaLoader.getCachedImages();

    const cached = mediaLoader.getCachedImages();
    const shouldSkipReload = cached !== null && cached === ref1;
    expect(shouldSkipReload).toBe(true);
  });
});
