import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../lib/useSession';
import { Text, useTheme } from '../design';

/**
 * Entry gate. There is no sign-in wall: we wait for the guest session to exist and then go
 * straight into the app. The only thing a first-time user should see is a brief spinner.
 */
export default function Index() {
  const t = useTheme();
  const { isReady, error } = useSession();

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.color.bg,
          justifyContent: 'center',
          padding: t.space.xl,
          gap: t.space.md,
        }}
      >
        <Text variant="headline">Couldn't start a session</Text>
        <Text variant="body" tone="muted">
          {String((error as { message?: string }).message ?? error)}
        </Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={t.color.signal} />
      </View>
    );
  }

  return <Redirect href="/(app)" />;
}
