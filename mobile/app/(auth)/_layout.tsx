import { Redirect, Stack } from 'expo-router';
import { useInstantClerkAuth } from '../../lib/useInstantClerkAuth';

export default function AuthLayout() {
  const { isReady, isSignedIn } = useInstantClerkAuth();

  if (isReady && isSignedIn) return <Redirect href="/(app)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
