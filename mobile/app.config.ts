import type { ExpoConfig } from 'expo/config';

// Clerk and Instant read these at RUNTIME, so build-time env vars alone aren't enough —
// they have to be re-declared under `extra` (same gotcha Legacy Made hit).
const IS_PROD = process.env.APP_VARIANT === 'production';

const config: ExpoConfig = {
  name: IS_PROD ? 'Camp List' : 'Camp List (Dev)',
  slug: 'camplist',
  scheme: 'camplist',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Dark mode from day one — the app is used at dusk around a campfire.
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: IS_PROD ? 'com.gibsonops.camplist' : 'com.gibsonops.camplist.dev',
  },
  android: {
    package: IS_PROD ? 'com.gibsonops.camplist' : 'com.gibsonops.camplist.dev',
    adaptiveIcon: {
      // Basalt, the app background from DESIGN.md. The previous value was a dark
      // green that predates the current palette and appears nowhere else in it.
      backgroundColor: '#0a0b0c',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  // datetimepicker is a native module: adding it here means the next dev build picks it up,
  // and an OTA update alone will NOT (see docs/setup.md).
  plugins: ['expo-router', '@react-native-community/datetimepicker'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Falls back to the dev app id so an EAS build without env vars configured still runs.
    // This value is public by design (see instant.perms.ts) — it is not a secret.
    instantAppId: process.env.EXPO_PUBLIC_INSTANT_APP_ID ?? '6eaf2c74-0277-43e6-a105-c642e76778a8',
    eas: {
      // Filled in by `eas init`; kept here so the config shape is obvious.
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
  owner: process.env.EAS_OWNER,
};

export default config;
