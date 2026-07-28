import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useFonts } from '../design';
import { suppressPullToRefresh } from '../lib/webChrome';

/**
 * No auth provider wraps the app. Camp List signs in as an InstantDB guest on first launch
 * (see lib/useSession.ts), so there is nothing to configure before the app is usable.
 */
export default function RootLayout() {
  // A downward swipe the app doesn't claim reloads the whole thing on mobile web — including
  // out from under an open sheet. See lib/webChrome.ts.
  useEffect(suppressPullToRefresh, []);

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
