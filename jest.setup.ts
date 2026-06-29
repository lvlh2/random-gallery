// ---------------------------------------------------------------------------
// Global Jest setup — runs before every test suite
// ---------------------------------------------------------------------------

// Override Platform.OS to 'android' — this project is Android-focused.
// Must happen before any module that checks Platform.OS at load time.
const { Platform } = require("react-native");
Platform.OS = "android";
(Platform as any).select = (obj: any) => obj.android ?? obj.default;

// Mock AsyncStorage with an in-memory store that tests can access via (AsyncStorage as any).__store
// NOTE: jest-expo may already mock this; our factory takes precedence in setupFiles.
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store.clear();
        return Promise.resolve();
      }),
      // Attach store to default export so `import AsyncStorage from "..."` works
      __store: store,
    },
    // Also expose at module level for `import * as M from "..."` access
    __store: store,
  } as const;
});

// Mock gesture handler
jest.mock("react-native-gesture-handler", () => {
  const View = require("react-native").View;
  return {
    Gesture: {
      Simultaneous: jest.fn((...gestures: any[]) => ({ simultaneous: gestures })),
      Pinch: jest.fn(() => ({ pinch: true, enabled: jest.fn().mockReturnThis() })),
      Pan: jest.fn(() => ({
        pan: true,
        enabled: jest.fn().mockReturnThis(),
        minDistance: jest.fn().mockReturnThis(),
        activeOffsetY: jest.fn().mockReturnThis(),
        failOffsetX: jest.fn().mockReturnThis(),
        onStart: jest.fn().mockReturnThis(),
        onUpdate: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
        onFinalize: jest.fn().mockReturnThis(),
      })),
      Race: jest.fn(),
      Tap: jest.fn(),
    },
    GestureDetector: View,
    GestureHandlerRootView: View,
    Directions: { UP: 1, DOWN: 2, LEFT: 3, RIGHT: 4 },
  };
});

// Mock Reanimated — use the actual default export from react-native-reanimated
// but suppress the "no worklet" warnings in tests.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated/mock");
  return {
    ...actual,
    // Provide a basic animated wrapper that renders children directly
    default: {
      ...actual.default,
      View: require("react-native").View,
      Text: require("react-native").Text,
      Image: require("react-native").Image,
      FlatList: require("react-native").FlatList,
      ScrollView: require("react-native").ScrollView,
      FadeInDown: { duration: 0 },
      FadeIn: { duration: 0 },
      FadeOut: { duration: 0 },
      SlideInLeft: { duration: 0 },
      SlideInRight: { duration: 0 },
    },
  };
});

// Mock expo-router
jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn((cb: () => void | (() => void)) => {
    // Call the callback immediately (simulate focus on mount)
    const cleanup = cb();
    // Return the cleanup function
    return cleanup;
  }),
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  useGlobalSearchParams: jest.fn(() => ({})),
  Link: require("react-native").View,
  Stack: { Screen: require("react-native").View },
  Tabs: { Screen: require("react-native").View },
  Redirect: require("react-native").View,
}));

// Mock expo-image
jest.mock("expo-image", () => ({
  Image: require("react-native").Image,
}));

// Mock expo-file-system/legacy
jest.mock("expo-file-system/legacy", () => ({
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(() =>
      Promise.resolve({ granted: true, directoryUri: "content://test/folder" }),
    ),
    readDirectoryAsync: jest.fn(() => Promise.resolve([])),
  },
}));

// Mock expo-media-library/legacy
jest.mock("expo-media-library/legacy", () => ({
  getAlbumsAsync: jest.fn(() => Promise.resolve([])),
  getAssetsAsync: jest.fn(() =>
    Promise.resolve({ assets: [], endCursor: "0", hasNextPage: false, totalCount: 0 }),
  ),
}));

// Mock expo-splash-screen
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-font
jest.mock("expo-font", () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
}));

// Mock expo-web-browser
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: "dismiss" })),
  dismissBrowser: jest.fn(),
}));

// Mock expo-system-ui
jest.mock("expo-system-ui", () => ({
  setBackgroundColorAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-constants (provide default manifest)
jest.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      name: "Random Gallery",
      slug: "random-gallery",
    },
    manifest: {},
    manifest2: {},
  },
}));

// Mock expo-symbols (used in collapsible component)
jest.mock("expo-symbols", () => {
  const { View } = require("react-native");
  return {
    SymbolView: View,
  };
});

// Mock react-native-safe-area-context
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: require("react-native").View,
  SafeAreaProvider: require("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Suppress specific console warnings during tests
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  // Filter out Reanimated "no worklet" warnings
  if (typeof args[0] === "string" && args[0].includes("worklet")) return;
  // Filter out act() warnings from React Testing Library (we handle these)
  if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) return;
  originalWarn.call(console, ...args);
};
