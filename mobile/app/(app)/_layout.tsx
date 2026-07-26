import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../lib/useSession';
import { useTheme } from '../../design';

export default function AppLayout() {
  const t = useTheme();
  const { isReady } = useSession();

  // Only ever a brief wait for the guest session; there's no signed-out destination.
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={t.color.signal} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
