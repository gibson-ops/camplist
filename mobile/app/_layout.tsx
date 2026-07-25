import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';

const CLERK_PUBLISHABLE_KEY = Constants.expoConfig?.extra?.clerkPublishableKey as
  | string
  | undefined;

export default function RootLayout() {
  if (!CLERK_PUBLISHABLE_KEY) {
    throw new Error(
      'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY — copy mobile/.env.example to mobile/.env and fill it in.',
    );
  }

  return (
    // tokenCache persists the Clerk session in expo-secure-store so a cold launch
    // (common: phone died at camp) doesn't force a re-login.
    <ClerkProvider tokenCache={tokenCache} publishableKey={CLERK_PUBLISHABLE_KEY}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </ClerkProvider>
  );
}
