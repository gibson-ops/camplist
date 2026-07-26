import { init, id, i, type InstaQLEntity } from '@instantdb/react';
import Constants from 'expo-constants';
import schema, { type AppSchema } from '../../instant.schema';

/**
 * Web variant of lib/db.ts, selected automatically by Metro when bundling for web.
 *
 * Same exported surface as the native module, so no calling code changes between platforms.
 * The differences are real but confined here:
 *   • `@instantdb/react` instead of `@instantdb/react-native`
 *   • persistence is IndexedDB rather than AsyncStorage (still offline-first)
 *   • no `react-native-get-random-values` shim; the browser has crypto natively
 */

export const INSTANT_APP_ID =
  (Constants.expoConfig?.extra?.instantAppId as string | undefined) ??
  (process.env.EXPO_PUBLIC_INSTANT_APP_ID as string | undefined);

if (!INSTANT_APP_ID) {
  throw new Error('Missing EXPO_PUBLIC_INSTANT_APP_ID — set it in the web build environment.');
}

export const db = init({
  appId: INSTANT_APP_ID,
  schema,
  useDateObjects: true,
});

export { id, i };
export type { AppSchema, InstaQLEntity };
