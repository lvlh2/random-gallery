# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Always

- Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## Build & Run

```bash
npm install                        # install dependencies
npx expo start                     # dev server (scan QR with Expo Go)
npx expo start --android           # launch on connected device/emulator
```

### APK Build (Local)

Requires JDK 17 and Android SDK at `%LOCALAPPDATA%\Android\Sdk`. The `android/` directory is generated (gitignored) and must be regenerated when dependencies change:

```bash
npx expo prebuild --clean          # regenerate android/ from app.json
cd android && gradlew assembleRelease
# APK output: android/app/build/outputs/apk/release/random-gallery.apk
```

Version bumps require editing BOTH `app.json` and `android/app/build.gradle` (`versionCode` and `versionName`).

### APK Build (Cloud)

```bash
npx eas-cli build --platform android --profile preview
```

## Architecture

### Route structure (Expo Router file-based)

```
src/app/
  _layout.tsx              # Root Stack: (tabs) + viewer modal
  index.tsx                # Redirect / → /random
  viewer.tsx               # Full-screen viewer (fullScreenModal, no animation)
  (tabs)/
    _layout.tsx            # NativeTabs: Random + Folders
    random.tsx             # Paged thumbnail grid (3 cols × ~5 rows per screen)
    folders.tsx            # SAF folder import, checkbox toggle, remove
```

### Data flow — three-layer cache system

1. **`src/services/media-loader.ts`** — Persistent in-memory image cache (`_cachedImages`). Uses MediaStore (fast SQL query) with SAF fallback. Invalidated on folder changes or app foreground. Exposes `getCachedImages()`, `loadImages()`, `updateCachedImages()`, `invalidateCache()`.

2. **`src/services/viewer-state.ts`** — Bridge between grid and viewer. Stores the current shuffled list so the viewer doesn't need route params for 3000+ URIs. Exposes `setViewerImages()`, `getViewerImages()`, `clearViewerImages()`.

3. **`src/app/(tabs)/random.tsx`** — Component state (`images`, initialized from cache). Uses `useFocusEffect` to sync from cache (detecting deleterions via ref comparison). Manual shuffle via FAB button calls `fisherYatesShuffle()` then updates all three layers.

**Rule**: Every mutation (delete, shuffle, reload) must call `updateCachedImages()` so the cache stays authoritative. The `imagesRef` is the single ref used to detect staleness.

### Random tab — paged grid

Images are shuffled once via Fisher-Yates, then split into pages of `ROWS_PER_PAGE × 3` (dynamically computed from screen height). A vertical `FlatList` with `getItemLayout` renders each page as a wrapped row of thumbnails. `windowSize={3}` limits off-screen rendering.

### Viewer — gesture composition

Each image page uses `Gesture.Simultaneous(pinchGesture, panGesture)`. Horizontal swiping is handled by the FlatList's `pagingEnabled`. The pan gesture detects vertical swipes: up >120px triggers delete confirmation, down >120px calls `router.back()`.

### Folder import (Android only)

Uses `StorageAccessFramework.requestDirectoryPermissionsAsync()` from `expo-file-system/legacy`. Folder URI is persisted to AsyncStorage (`src/services/folders.ts`). MediaStore album matching is attempted first; SAF directory scan is the fallback.

### Theme

Always dark. `app.json` has `userInterfaceStyle: "dark"`. `useTheme()` returns `Colors.dark`. Splash screen is black background with app logo.

## Tests

```bash
npm test              # run all 116 tests across 9 suites
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

116 tests in 9 suites covering services, integration flows, and components. See `src/__tests__/README.md` for full documentation.

Key test files:
- `src/__tests__/services/` — unit tests for all 5 services (image-utils, random, folders, media-loader, viewer-state)
- `src/__tests__/integration/` — three-layer cache consistency & delete lifecycle
- `src/__tests__/components/` — themed-text and themed-view rendering

When adding features, add corresponding tests. Run `npm test` before committing.
