import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useInstantClerkAuth } from '../../lib/useInstantClerkAuth';
import { theme } from '../../lib/theme';

export default function AppLayout() {
  const { isReady, isSignedIn } = useInstantClerkAuth();

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
