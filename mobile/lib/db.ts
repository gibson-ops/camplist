import 'react-native-get-random-values';
import { init } from '@instantdb/react-native';
import Constants from 'expo-constants';
import schema from '../../instant.schema';

/**
 * The InstantDB app id is public by design (permissions are enforced server-side by the
 * CEL rules in instant.perms.ts). Environments are separate Instant apps, not separate
 * keys on one app.
 */
export const INSTANT_APP_ID = Constants.expoConfig?.extra?.instantAppId as string | undefined;

if (!INSTANT_APP_ID) {
  throw new Error(
    'Missing EXPO_PUBLIC_INSTANT_APP_ID — copy mobile/.env.example to mobile/.env and fill it in.',
  );
}

/**
 * Name of the auth client registered with Instant via
 * `instant-cli auth client add --type clerk --name <name>`. Instant uses it to pick which
 * Clerk publishable key to verify the incoming id token against.
 */
export const INSTANT_CLERK_CLIENT_NAME = (Constants.expoConfig?.extra
  ?.instantClerkClientName ?? 'clerk') as string;

/**
 * Offline-first by default: @instantdb/react-native persists to AsyncStorage, resolves
 * queries against the local cache, and buffers transactions until the device reconnects.
 * No extra configuration is needed to keep working with no signal.
 */
export const db = init({
  appId: INSTANT_APP_ID,
  schema,
  useDateObjects: true,
});
