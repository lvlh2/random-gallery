// ---------------------------------------------------------------------------
// Unit tests for image-utils.ts
// Regression coverage: image extension detection logic
// ---------------------------------------------------------------------------

import { isImageFile } from "@/services/image-utils";

describe("isImageFile", () => {
  // ---- Known supported extensions (case-insensitive) ----
  const supported = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".heic",
    ".heif",
  ];

  test.each(supported)("returns true for extension %s", (ext) => {
    expect(isImageFile(`photo${ext}`)).toBe(true);
    expect(isImageFile(`PHOTO${ext.toUpperCase()}`)).toBe(true);
    expect(isImageFile(`/path/to/img${ext}`)).toBe(true);
    expect(isImageFile(`content://com.android/pic${ext}`)).toBe(true);
  });

  // ---- Known unsupported extensions ----
  const unsupported = [
    ".mp4",
    ".mov",
    ".avi",
    ".pdf",
    ".txt",
    ".doc",
    ".docx",
    ".zip",
    ".mp3",
    ".svg",
    ".raw",
    ".tiff",
  ];

  test.each(unsupported)("returns false for extension %s", (ext) => {
    expect(isImageFile(`file${ext}`)).toBe(false);
  });

  // ---- Edge cases ----

  test("returns false for URI with no extension", () => {
    expect(isImageFile("photo")).toBe(false);
    expect(isImageFile("/path/to/photo")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isImageFile("")).toBe(false);
  });

  test("handles dotfiles correctly (no extension, just a leading dot)", () => {
    // This is the correct behavior: ".hidden" has no image extension
    // because lastIndexOf(".") returns 0, and slice(0) gives ".hidden"
    // which is not in the set
    expect(isImageFile(".hidden")).toBe(false);
  });

  test("handles multiple dots — only checks the last extension", () => {
    // "photo.backup.jpg" — last dot at position 12, ext = ".jpg" → true
    expect(isImageFile("photo.backup.jpg")).toBe(true);
    // "photo.jpg.backup" — last dot at position 13, ext = ".backup" → false
    expect(isImageFile("photo.jpg.backup")).toBe(false);
  });

  test("single-character filename with image extension", () => {
    expect(isImageFile("a.png")).toBe(true);
  });

  test("very long URI with image extension", () => {
    const longUri =
      "content://com.android.externalstorage.documents/tree/primary%3ADCIM%2FCamera/document/primary%3ADCIM%2FCamera%2FIMG_20240101_123456.jpg";
    expect(isImageFile(longUri)).toBe(true);
  });

  test("URI with query parameters containing dots", () => {
    // Extension detection should still work because the file has .jpg before the query
    expect(isImageFile("photo.jpg?width=200&height=200")).toBe(false);
    // ⬆ This is a potential bug — if URIs have query params, isImageFile will fail.
    // The test documents current behavior. If you fix isImageFile to strip query
    // params, update this test.
  });
});
