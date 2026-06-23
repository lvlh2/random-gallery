/**
 * In-memory bridge between the Random grid screen and the full-screen Viewer modal.
 *
 * We store the shuffled image list here instead of passing it through route params
 * because the URI array can be very large and route params have size limits.
 */

export interface ViewerImage {
  uri: string;
  name: string;
}

let _currentImages: ViewerImage[] = [];

export function setViewerImages(images: ViewerImage[]): void {
  _currentImages = images;
}

export function getViewerImages(): ViewerImage[] {
  return _currentImages;
}

export function clearViewerImages(): void {
  _currentImages = [];
}
