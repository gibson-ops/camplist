import 'react-native-get-random-values';
import { init, id, i, type InstaQLEntity } from '@instantdb/react-native';
import Constants from 'expo-constants';
import schema, { type AppSchema } from '../../instant.schema';

/**
 * The ONLY module that imports an InstantDB SDK.
 *
 * Instant ships a different package per platform (`@instantdb/react-native` here,
 * `@instantdb/react` in db.web.ts), so everything else in the app imports `db`, `id`, and
 * types from this module. Metro picks the `.web.ts` variant automatically when bundling for
 * web, which keeps first-class web support a one-file swap instead of a migration.
 *
 * Corollary: never `import { ... } from '@instantdb/react-native'` anywhere else.
 */

export const INSTANT_APP_ID = Constants.expoConfig?.extra?.instantAppId as string | undefined;

if (!INSTANT_APP_ID) {
  throw new Error(
    'Missing EXPO_PUBLIC_INSTANT_APP_ID — copy mobile/.env.example to mobile/.env and fill it in.',
  );
}

/**
 * Offline-first by default: the React Native SDK persists to AsyncStorage, resolves queries
 * against the local cache, and buffers transactions until the device reconnects. No extra
 * configuration is needed to keep working with no signal.
 */
export const db = init({
  appId: INSTANT_APP_ID,
  schema,
  useDateObjects: true,
});

export { id, i };
export type { AppSchema, InstaQLEntity };
