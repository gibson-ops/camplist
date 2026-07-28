import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useFonts } from '../design';
import { tuneWebViewport } from '../lib/webChrome';

/**
 * No auth provider wraps the app. Camp List signs in as an InstantDB guest on first launch
 * (see lib/useSession.ts), so there is nothing to configure before the app is usable.
 */
export default function RootLayout() {
  // Mobile browsers measure 100vh against a viewport taller than you can see, and treat an
  // unclaimed downward swipe as a page reload. Neither is right for an app. See lib/webChrome.
  useEffect(tuneWebViewport, []);

  // Hold first paint until Inter resolves, otherwise text flashes in the system face and reflows.
  const fontsReady = useFonts();
  if (!fontsReady) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
