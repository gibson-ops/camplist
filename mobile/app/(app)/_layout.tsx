import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useInstantClerkAuth } from '../../lib/useInstantClerkAuth';
import { useTheme } from '../../design';

export default function AppLayout() {
  const t = useTheme();
  const { isReady, isSignedIn } = useInstantClerkAuth();

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={t.color.signal} />
      </View>
    );
  }

  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
