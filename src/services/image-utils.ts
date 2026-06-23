const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".heic",
  ".heif",
]);

/**
 * Check whether a file URI or name has a recognized image extension.
 */
export function isImageFile(uri: string): boolean {
  const lastDot = uri.lastIndexOf(".");
  if (lastDot === -1) return false;
  const ext = uri.slice(lastDot).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}
