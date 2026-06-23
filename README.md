# Random Gallery

A random-browsing photo gallery app for Android, built with [Expo](https://expo.dev) (SDK 56).

Shuffle through your photo collection in random order. Import folders without copying files — images are read directly from their source locations via Android's Storage Access Framework.

## Features

- **Random browsing** — photos displayed in a shuffled grid; order changes every visit
- **Folder import via SAF** — pick folders from your device; no files are copied
- **Selective browsing** — choose which folders to include via checkboxes
- **Dark theme** — always-dark UI
- **Full-screen viewer** — pinch to zoom, swipe horizontally to navigate, swipe up to delete
- **Native UI** — uses `@expo/ui` for Material Design components

## Screenshots

| Random Grid | Full-screen Viewer | Folder Management |
|:-----------:|:------------------:|:-----------------:|
| *(add screenshots)* | *(add screenshots)* | *(add screenshots)* |

## Tech Stack

- [Expo SDK 56](https://docs.expo.dev/versions/v56.0.0/)
- [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routing)
- [`@expo/ui`](https://docs.expo.dev/versions/latest/sdk/ui/) (native Material / SwiftUI components)
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) (animations)
- [React Native Gesture Handler](https://docs.swmansion.com/react-native-gesture-handler/) (gestures)
- [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/) (SAF folder access)
- [expo-image](https://docs.expo.dev/versions/latest/sdk/image/) (optimized image loading)

## Getting Started

### Prerequisites

- Node.js 20+
- An Android device or emulator (API 30+)

### Install

```bash
npm install
```

### Run

```bash
# Start the dev server
npx expo start

# Or directly launch on Android
npx expo start --android
```

Scan the QR code with [Expo Go](https://expo.dev/go) on your phone, or connect an Android emulator.

### Build APK

```bash
npx eas-cli build --platform android --profile preview
```

Requires an [Expo account](https://expo.dev/signup). The build runs in the cloud and produces a downloadable APK.

## Project Structure

```
src/
  app/
    _layout.tsx           # Root Stack navigator
    index.tsx             # Redirect / → /random
    viewer.tsx            # Full-screen viewer (modal)
    (tabs)/
      _layout.tsx         # NativeTabs (Random + Folders)
      random.tsx          # Shuffled image grid
      folders.tsx         # Folder import & management
  services/
    folders.ts            # Folder CRUD (AsyncStorage)
    random.ts             # Fisher-Yates shuffle
    viewer-state.ts       # Grid ↔ Viewer state bridge
    image-utils.ts        # Image file filtering
  hooks/
    use-theme.ts          # Dark theme hook
  constants/
    theme.ts              # Colors, spacing, fonts
```

## License

MIT
