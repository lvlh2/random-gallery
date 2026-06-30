# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Always

- Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.
- Run `npx prettier . --check` and `npx expo lint` before committing. Use `npx prettier . -w` to auto-fix formatting.

## Build & Run

```bash
npm install                        # install dependencies
npx expo start                     # dev server (scan QR with Expo Go)
npx expo start --android           # launch on connected device/emulator
```

### APK Build (Local) — ⚠️ READ THIS FIRST ⚠️

**CRITICAL: `npx expo prebuild` RESETS `versionCode` to `1` in `android/app/build.gradle`!**
Since `android/` is **gitignored**, the previous `versionCode` is **lost forever** once overwritten. Android rejects installations with a lower `versionCode` than what's already on the phone. The phone's installed `versionCode` is the only source of truth — you must know it before making changes.

#### Routine build (code changes only, no new native deps)

```bash
cd android && gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/random-gallery.apk
```

**Do NOT run `expo prebuild`** — it's unnecessary and destroys `versionCode`.

#### Version bump (e.g. 1.0.6 → 1.0.7)

Edit **THREE** values, all manually:

1. `app.json`: `"version": "X.Y.Z"`
2. `android/app/build.gradle`: `versionCode N` (integer, **MUST be higher** than previous — increment by 1 from last known)
3. `android/app/build.gradle`: `versionName "X.Y.Z"` (string, matches app.json)

Then: `cd android && gradlew assembleRelease`

**Current values — UPDATE THESE when bumping:**

| Field         | Value   |
| ------------- | ------- |
| `version`     | `1.0.9`  |
| `versionCode` | `10`     |

#### When `expo prebuild --clean` IS needed

Only when native dependencies change (new expo packages, react-native version bump, etc.). After running it, you **MUST** manually restore `versionCode` in `android/app/build.gradle` before building.

### APK Build (Cloud)

```bash
npx eas-cli build --platform android --profile preview
```

### Lint & Format

```bash
npx expo lint           # ESLint check (0 errors required)
npx prettier . --check  # format check
npx prettier . -w       # auto-format all files
```

## CI/CD

GitHub Actions (`.github/workflows/check.yml`) runs on every push and PR to `master`:

| Job              | Command            | Blocking |
| ---------------- | ------------------ | -------- |
| TypeScript Check | `npx tsc --noEmit` | ✅ Yes   |
| Lint             | `npx expo lint`    | ✅ Yes   |
| Tests            | `npm test`         | ✅ Yes   |

The workflow fails if any job fails — fix before merging.

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

### Key config files

| File                 | Purpose                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.json`      | TypeScript config — test files and jest.setup.ts are excluded since `@types/jest` types conflict with TS 6.0                                                      |
| `eslint.config.js`   | ESLint flat config — extends `eslint-config-expo`, ignores test files, downgrades pre-existing `react-hooks/refs` and `set-state-in-effect` from error to warning |
| `jest.setup.ts`      | Global Jest mocks for all expo/RN modules, sets `Platform.OS = "android"`                                                                                         |
| `src/types/css.d.ts` | Type declarations for `*.css` and `*.module.css` imports (needed for `tsc` on Linux)                                                                              |

### Data flow — three-layer cache system

1. **`src/services/media-loader.ts`** — Persistent in-memory image cache (`_cachedImages`). Uses MediaStore (fast SQL query) with SAF fallback. Invalidated on folder changes or app foreground. Exposes `getCachedImages()`, `loadImages()`, `updateCachedImages()`, `invalidateCache()`.

2. **`src/services/viewer-state.ts`** — Bridge between grid and viewer. Stores the current shuffled list so the viewer doesn't need route params for 3000+ URIs. Exposes `setViewerImages()`, `getViewerImages()`, `clearViewerImages()`.

3. **`src/app/(tabs)/random.tsx`** — Component state (`images`, initialized from cache). Uses `useFocusEffect` to sync from cache (detecting deleterions via ref comparison). Manual shuffle via FAB button calls `fisherYatesShuffle()` then updates all three layers.

**Rule**: Every mutation (delete, shuffle, reload) must call `updateCachedImages()` so the cache stays authoritative. The `imagesRef` is the single ref used to detect staleness.

### Random tab — paged grid

Images are shuffled once via Fisher-Yates, then split into pages of `ROWS_PER_PAGE × 3` (dynamically computed from screen height). A vertical `FlatList` with `getItemLayout` renders each page as a wrapped row of thumbnails. `windowSize={3}` limits off-screen rendering.

### Viewer — gallery with pinch-to-zoom

Uses `react-native-zoom-toolkit`'s `<Gallery>` component, which wraps a FlatList with built-in Reanimated + RNGH gesture handling for pinch-to-zoom, pan, and double-tap. Replaces the previous hand-rolled gesture composition.

- **Horizontal swiping**: Gallery handles page switching via internal FlatList.
- **Pinch-to-zoom**: Gallery handles zoom in/out with `scaleMode="bounce"` and `pinchMode="clamp"` — no custom gesture code needed.
- **Vertical swipe delete/back**: Gallery's `onVerticalPull` worklet callback fires with `{ translateY, released }`. Only active when `scale === 1` (Gallery guarantees this). `translateY < -120` shows delete confirmation; `translateY > 120` calls `router.back()` to exit the viewer (with `exitingRef` guard + `router.replace("/random")` fallback).
- **Navigation**: Stack root layout uses `contentStyle: { backgroundColor: "#000" }` to prevent white flash during transitions.

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
