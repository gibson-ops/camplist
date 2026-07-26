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
      backgroundColor: '#0B1A14',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-router'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    instantAppId: process.env.EXPO_PUBLIC_INSTANT_APP_ID,
  },
};

export default config;
