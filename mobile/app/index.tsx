import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useInstantClerkAuth } from '../lib/useInstantClerkAuth';
import { useTheme } from '../design';

/**
 * Entry gate. Holds until BOTH Clerk and Instant have settled, so we never route into the
 * app with a Clerk session but no Instant session (which would make every query fail perms).
 */
export default function Index() {
  const t = useTheme();
  const { isReady, isSignedIn } = useInstantClerkAuth();

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={t.color.signal} />
      </View>
    );
  }

  return <Redirect href={isSignedIn ? '/(app)' : '/(auth)/sign-in'} />;
}
