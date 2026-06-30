// ---------------------------------------------------------------------------
// Unit tests for media-loader.ts
// Regression coverage: three-layer cache system, MediaStore/SAF loading,
// cache invalidation triggers
// ---------------------------------------------------------------------------

import type { FolderImport } from "@/services/folders";
import type { ViewerImage } from "@/services/viewer-state";

// These mock modules are set up by jest.setup.ts
const MediaLibrary = require("expo-media-library/legacy");
const SAF = require("expo-file-system/legacy").StorageAccessFramework;

// Import the actual module (mock conditional requires use jest.setup.ts mocks)
import * as mediaLoader from "@/services/media-loader";

beforeEach(() => {
  // Reset cache state via public API (not resetModules — those break mock refs)
  mediaLoader.invalidateCache();
  // Reset all mock histories
  jest.clearAllMocks();
  // Reset mock implementations to safe defaults
  MediaLibrary.getAlbumsAsync.mockReset();
  MediaLibrary.getAssetsAsync.mockReset();
  SAF.readDirectoryAsync.mockReset();
});

// ---- Helpers ----

function makeFolders(
  count: number,
  overrides: Partial<FolderImport>[] = [],
): FolderImport[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `folder-${i}`,
    uri: `content://test/folder-${i}`,
    name: `Folder ${i}`,
    enabled: overrides[i]?.enabled ?? true,
  }));
}

function mockMediaAssets(
  folderIndex: number,
  count: number,
): Array<{ uri: string; filename: string }> {
  return Array.from({ length: count }, (_, i) => ({
    uri: `content://media/external/images/${folderIndex}/img_${i}.jpg`,
    filename: `img_${i}.jpg`,
  }));
}

// ---- getCachedImages ----

describe("getCachedImages", () => {
  test("returns null initially", () => {
    expect(mediaLoader.getCachedImages()).toBeNull();
  });
});

// ---- invalidateCache ----

describe("invalidateCache", () => {
  test("sets cache to null even if it was previously populated", () => {
    mediaLoader.updateCachedImages([{ uri: "a.jpg", name: "a.jpg" }]);
    expect(mediaLoader.getCachedImages()).not.toBeNull();

    mediaLoader.invalidateCache();
    expect(mediaLoader.getCachedImages()).toBeNull();
  });

  test("invalidateCache on already-null cache is a no-op", () => {
    expect(mediaLoader.getCachedImages()).toBeNull();
    mediaLoader.invalidateCache();
    expect(mediaLoader.getCachedImages()).toBeNull();
  });
});

// ---- updateCachedImages ----

describe("updateCachedImages", () => {
  test("stores the provided images", () => {
    const images: ViewerImage[] = [
      { uri: "a.jpg", name: "a.jpg" },
      { uri: "b.jpg", name: "b.jpg" },
    ];
    mediaLoader.updateCachedImages(images);
    expect(mediaLoader.getCachedImages()).toEqual(images);
  });

  test("stores empty array", () => {
    mediaLoader.updateCachedImages([]);
    expect(mediaLoader.getCachedImages()).toEqual([]);
  });

  test("overwrites previous cache", () => {
    mediaLoader.updateCachedImages([{ uri: "old.jpg", name: "old.jpg" }]);
    mediaLoader.updateCachedImages([{ uri: "new.jpg", name: "new.jpg" }]);
    expect(mediaLoader.getCachedImages()).toHaveLength(1);
    expect(mediaLoader.getCachedImages()![0].uri).toBe("new.jpg");
  });
});

// ---- loadImages ----

describe("loadImages", () => {
  test("returns empty array when no folders are enabled", async () => {
    const folders = makeFolders(2, [{ enabled: false }, { enabled: false }]);
    const result = await mediaLoader.loadImages(folders);
    expect(result).toEqual([]);
    expect(mediaLoader.getCachedImages()).toEqual([]);
  });

  test("returns empty array when folders list is empty", async () => {
    const result = await mediaLoader.loadImages([]);
    expect(result).toEqual([]);
    expect(mediaLoader.getCachedImages()).toEqual([]);
  });

  test("loads images via MediaStore when album matches", async () => {
    const assets = mockMediaAssets(0, 10);
    MediaLibrary.getAlbumsAsync.mockResolvedValue([
      { title: "Folder 0", count: 10 },
    ]);
    MediaLibrary.getAssetsAsync.mockResolvedValue({
      assets,
      endCursor: "end",
      hasNextPage: false,
      totalCount: 10,
    });

    const folders = makeFolders(1, [{ name: "Folder 0" }]);
    const result = await mediaLoader.loadImages(folders);

    expect(result).toHaveLength(10);
    expect(result[0].uri).toBe("content://media/external/images/0/img_0.jpg");
    expect(mediaLoader.getCachedImages()).toEqual(result);
  });

  test("falls back to SAF when no matching album is found", async () => {
    MediaLibrary.getAlbumsAsync.mockResolvedValue([
      { title: "Some Other Album", count: 5 },
    ]);
    SAF.readDirectoryAsync.mockResolvedValue([
      "content://test/folder-0/photo.jpg",
      "content://test/folder-0/video.mp4",
      "content://test/folder-0/another.PNG",
    ]);

    const folders = makeFolders(1, [{ name: "Folder 0" }]);
    const result = await mediaLoader.loadImages(folders);

    // Only the two images (jpg, png) should be included; mp4 is filtered out
    expect(result).toHaveLength(2);
    expect(result[0].uri).toBe("content://test/folder-0/photo.jpg");
    expect(result[1].uri).toBe("content://test/folder-0/another.PNG");
  });

  test("falls back to SAF when MediaStore.getAlbumsAsync throws", async () => {
    MediaLibrary.getAlbumsAsync.mockRejectedValue(
      new Error("Permission denied"),
    );
    SAF.readDirectoryAsync.mockResolvedValue([
      "content://test/folder-0/img.jpg",
    ]);

    const folders = makeFolders(1);
    const result = await mediaLoader.loadImages(folders);

    expect(result).toHaveLength(1);
  });

  test("handles partial folder failure gracefully (Promise.allSettled)", async () => {
    MediaLibrary.getAlbumsAsync.mockResolvedValue([
      { title: "Folder 0", count: 3 },
      { title: "Folder 1", count: 5 },
    ]);
    MediaLibrary.getAssetsAsync
      .mockResolvedValueOnce({
        assets: mockMediaAssets(0, 3),
        endCursor: "end",
        hasNextPage: false,
        totalCount: 3,
      })
      .mockRejectedValueOnce(new Error("Failed to read album"));

    const folders = makeFolders(2);
    const result = await mediaLoader.loadImages(folders);

    expect(result).toHaveLength(3);
  });

  test("all folders failing returns empty array", async () => {
    MediaLibrary.getAlbumsAsync.mockResolvedValue([]);
    SAF.readDirectoryAsync.mockRejectedValue(new Error("SAF also failed"));

    const folders = makeFolders(2);
    const result = await mediaLoader.loadImages(folders);

    expect(result).toEqual([]);
    expect(mediaLoader.getCachedImages()).toEqual([]);
  });
});

// ---- Cache stale detection (ref comparison) ----

describe("cache ref comparison (for random.tsx staleness detection)", () => {
  test("updateCachedImages stores the same reference (not a copy)", () => {
    const images: ViewerImage[] = [{ uri: "a.jpg", name: "a.jpg" }];
    mediaLoader.updateCachedImages(images);

    // getCachedImages returns the SAME array reference that was stored
    expect(mediaLoader.getCachedImages()).toBe(images);
  });

  test("invalidateCache then updateCachedImages with new array changes ref", () => {
    const oldImages: ViewerImage[] = [{ uri: "old.jpg", name: "old.jpg" }];
    mediaLoader.updateCachedImages(oldImages);
    const oldRef = mediaLoader.getCachedImages();

    mediaLoader.invalidateCache();
    const newImages: ViewerImage[] = [{ uri: "new.jpg", name: "new.jpg" }];
    mediaLoader.updateCachedImages(newImages);
    const newRef = mediaLoader.getCachedImages();

    expect(newRef).not.toBe(oldRef);
  });
});
