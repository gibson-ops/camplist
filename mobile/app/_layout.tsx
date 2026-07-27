import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useFonts } from '../design';

/**
 * No auth provider wraps the app. Camp List signs in as an InstantDB guest on first launch
 * (see lib/useSession.ts), so there is nothing to configure before the app is usable.
 */
export default function RootLayout() {
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
