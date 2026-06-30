# Test Suite for Random Gallery

## Running Tests

```bash
npm test              # run all tests once
npm run test:watch    # watch mode (re-run on file changes)
npm run test:coverage # run with coverage report
```

## Test Structure

```
src/__tests__/
  services/           # Unit tests — pure logic, no React rendering
    image-utils.test.ts    # isImageFile() extension detection
    random.test.ts         # fisherYatesShuffle() correctness & distribution
    folders.test.ts        # Folder CRUD with mocked AsyncStorage
    media-loader.test.ts   # Cache management, MediaStore/SAF loading
    viewer-state.test.ts   # In-memory bridge state
  integration/        # Multi-service flows
    cache-consistency.test.ts  # Three-layer cache sync (load/shuffle/delete)
    delete-flow.test.ts        # Full viewer delete lifecycle
  components/         # Component rendering tests
    themed-text.test.tsx   # ThemedText type variants & props
    themed-view.test.tsx   # ThemedView rendering & children
```

## What Each Suite Covers

### `image-utils.test.ts`

- All 8 supported image extensions (case-insensitive)
- 12 unsupported extensions
- Edge cases: no extension, empty string, dotfiles, multiple dots, long URIs

### `random.test.ts`

- Length preservation, element preservation, no mutation of input
- Empty/single/two-element arrays
- Statistical distribution test (6000 iterations, ±50% tolerance)
- Works with strings, objects, and 10K-element arrays

### `folders.test.ts`

- `getFolders`: empty storage, valid data, malformed JSON, non-array values
- `saveFolders`: persistence, overwrite, empty array
- `addFolder`: new folder (auto-enabled, ID generated), appending to existing
- `removeFolder`: matching ID, nonexistent ID, empty list
- `toggleFolder`: true→false, false→true, non-mutation of other folders, immutability

### `media-loader.test.ts`

- `getCachedImages`: starts null
- `invalidateCache`: clears populated cache, no-op on null
- `updateCachedImages`: stores/overwrites/empties
- `loadImages`:
  - Empty/disabled folders → empty result
  - Album match via MediaStore
  - SAF fallback when no album matches (filters non-images)
  - SAF fallback when MediaStore throws
  - Partial folder failure (Promise.allSettled — surviving results returned)
  - All folders failing → empty result
- Ref comparison for staleness detection

### `viewer-state.test.ts`

- Round-trip set/get, initial empty, overwrite, clear
- Large arrays (5000 items)
- Reference semantics (set/get return the same reference — documenting current behavior)

### `cache-consistency.test.ts` (integration)

**Simulates real app orchestration across all three cache layers:**

1. **Initial load**: loadImages → shuffle → update all layers → verify agreement
2. **Delete image**: remove from viewer → update layers → verify consistency
3. **Delete last image**: all layers cleared
4. **Shuffle FAB**: re-shuffle preserves all images, all layers agree
5. **Folder change**: invalidateCache sets cache to null
6. **Ref-based staleness**: deleting changes ref so grid detects the update

### `delete-flow.test.ts` (integration)

**End-to-end deletion lifecycle:**

- Delete middle image (ref comparison, array update)
- Delete first image (index adjustment)
- Delete last image (index adjustment)
- Delete only image (clear all, navigate back)
- Sequential deletes (3 in a row, cache stays consistent)
- Delete all at once
- No-op when no mutations (grid skips reload)

### Component tests

- `themed-text.test.tsx`: all 8 type variants, themeColor prop, style merging, empty/numeric/nested children
- `themed-view.test.tsx`: rendering, children, type prop, style prop, nesting

## Mock Infrastructure

- **jest.setup.ts**: Global mocks for AsyncStorage, Gesture Handler, Reanimated, expo-router, expo-image, expo-media-library, expo-file-system, expo-splash-screen, expo-font, expo-web-browser, expo-system-ui, expo-constants, expo-symbols, safe-area-context
- **\_\_mocks\_\_/styleMock.js**: CSS import stub (prevents parse errors on `.css` files)
- **package.json jest config**: `jest-expo` preset + `@/*` path alias + CSS module mapping

## Adding New Tests

1. Service tests go in `src/__tests__/services/` — mock dependencies, test pure logic
2. Integration tests go in `src/__tests__/integration/` — orchestrate multiple services
3. Component tests go in `src/__tests__/components/` — render with `@testing-library/react-native`
4. Follow the existing patterns for mock setup and `beforeEach` cleanup

**Important for new tests:**

- `render()` from `@testing-library/react-native` v14 is **async** — always `await render(...)`
- Use `screen.getByXxx()` queries (not destructured from `render`)
- For services with module-level state, use the public invalidate/reset APIs in `beforeEach`
- The test environment has `Platform.OS = "android"` (set in jest.setup.ts)
