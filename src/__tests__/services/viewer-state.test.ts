// ---------------------------------------------------------------------------
// Unit tests for viewer-state.ts
// Regression coverage: in-memory bridge state between grid and viewer
// ---------------------------------------------------------------------------

import {
  setViewerImages,
  getViewerImages,
  clearViewerImages,
} from "@/services/viewer-state";
import type { ViewerImage } from "@/services/viewer-state";

// NOTE: Because viewer-state.ts uses module-level mutable state,
// tests are order-sensitive. We reset before each test.

beforeEach(() => {
  // Reset to initial state
  clearViewerImages();
});

function makeImages(count: number): ViewerImage[] {
  return Array.from({ length: count }, (_, i) => ({
    uri: `content://test/img_${i}.jpg`,
    name: `img_${i}.jpg`,
  }));
}

describe("viewer-state", () => {
  // ---- set + get ----

  test("setViewerImages and getViewerImages round-trip", () => {
    const images = makeImages(5);
    setViewerImages(images);
    expect(getViewerImages()).toEqual(images);
  });

  test("getViewerImages returns empty array initially", () => {
    expect(getViewerImages()).toEqual([]);
  });

  test("setViewerImages with empty array", () => {
    setViewerImages([]);
    expect(getViewerImages()).toEqual([]);
  });

  test("setViewerImages overwrites previous value", () => {
    setViewerImages(makeImages(3));
    setViewerImages(makeImages(5));
    expect(getViewerImages()).toHaveLength(5);
  });

  // ---- clear ----

  test("clearViewerImages resets to empty array", () => {
    setViewerImages(makeImages(10));
    clearViewerImages();
    expect(getViewerImages()).toEqual([]);
  });

  test("clearViewerImages is idempotent", () => {
    clearViewerImages();
    clearViewerImages();
    expect(getViewerImages()).toEqual([]);
  });

  // ---- Large data ----

  test("handles large image arrays", () => {
    const images = makeImages(5000);
    setViewerImages(images);
    expect(getViewerImages()).toHaveLength(5000);
    expect(getViewerImages()[0].uri).toBe("content://test/img_0.jpg");
    expect(getViewerImages()[4999].uri).toBe("content://test/img_4999.jpg");
  });

  // ---- Reference behavior ----

  test("setViewerImages stores a reference, not a copy", () => {
    // Current behavior: setViewerImages stores the array reference directly.
    // So mutating the original array AFTER calling setViewerImages will affect
    // the stored state. This test documents that behavior.
    const images = makeImages(3);
    setViewerImages(images);
    images.push(makeImages(1)[0]);
    expect(getViewerImages()).toHaveLength(4);
    // If you change setViewerImages to clone its input, update this test.
  });

  test("mutating returned reference from getViewerImages affects stored state", () => {
    // Current behavior: getViewerImages returns the stored reference directly.
    // So mutations to the returned array affect the stored state.
    setViewerImages(makeImages(3));
    const images = getViewerImages();
    images.push(makeImages(1)[0]);
    expect(getViewerImages()).toHaveLength(4);
    // If you change getViewerImages to return a copy, update this test.
  });
});
