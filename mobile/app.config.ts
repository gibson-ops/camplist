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
    // iOS 18 renders three appearances. Light and dark are separate drawings, not
    // recolors: Survey Amber measures 1.53:1 on paper, so the light icon drops the
    // amber contour and spends its amber only on the packed control, which is a
    // fill and therefore legal. `tinted` must be grayscale on transparent — the
    // system supplies its own background behind it.
    icon: {
      light: './assets/icon-light.png',
      dark: './assets/icon.png',
      tinted: './assets/icon-tinted.png',
    },
  },
  android: {
    package: IS_PROD ? 'com.gibsonops.camplist' : 'com.gibsonops.camplist.dev',
    adaptiveIcon: {
      // Charcoal, matching the icon tile. The original value was a dark green that
      // predated the current palette and appeared nowhere else in it.
      backgroundColor: '#191b1e',
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
