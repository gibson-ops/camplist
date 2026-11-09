/**
 * PowerSync spike client: the local database, guest auth, and the connector.
 *
 * Storage depends on the build:
 * - a build that includes op-sqlite gets a real SQLite file, which survives killing the app;
 * - an older build (no native module) falls back to SQL.js, in memory, so the spike still runs
 *   without a rebuild.
 */
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLJSOpenFactory } from '@powersync/adapter-sql-js';
import {
  PowerSyncDatabase,
  Schema,
  Table,
  column,
  createConsoleLogger,
  LogLevels,
  type CommonPowerSyncDatabase,
  type PowerSyncBackendConnector,
} from '@powersync/react-native';

export const API_URL =
  process.env.EXPO_PUBLIC_SPIKE_API_URL ?? 'https://cl-api-powersync.argo.gibsonops.com';
const SYNC_URL =
  process.env.EXPO_PUBLIC_SPIKE_SYNC_URL ?? 'https://cl-sync-powersync.argo.gibsonops.com';
const TOKEN_KEY = 'spike.powersync.sessionToken';
const USER_ID_KEY = 'spike.powersync.userId';
const DB_FILENAME = 'camplist-spike.db';

/** True when this build has op-sqlite linked. Its JS throws at import otherwise, so check first. */
const hasNativeSqlite = NativeModules.OPSQLite != null;
export const STORAGE_LABEL = hasNativeSqlite ? 'SQLite on disk' : 'in memory (SQL.js)';

/** Client-side mirror of spike/db/01-schema.sql. PowerSync adds the `id` column itself. */
const schema = new Schema({
  households: new Table({ name: column.text }),
  household_members: new Table({ household_id: column.text, user_id: column.text }),
  lists: new Table({ household_id: column.text, name: column.text, created_at: column.text }),
  items: new Table({
    household_id: column.text,
    list_id: column.text,
    name: column.text,
    state: column.text,
    sort: column.integer,
    updated_at: column.text,
    updated_by: column.text,
  }),
  presence: new Table({
    household_id: column.text,
    list_id: column.text,
    user_id: column.text,
    name: column.text,
    seen_at: column.text,
  }),
});

// Spike: verbose, so sync problems show in Metro's log.
const logger = createConsoleLogger({ prefix: 'powersync', minLevel: LogLevels.debug });

export const db = hasNativeSqlite
  ? new PowerSyncDatabase({ schema, logger, database: { dbFilename: DB_FILENAME } })
  : new PowerSyncDatabase({
      schema,
      logger,
      factory: new SQLJSOpenFactory({ dbFilename: DB_FILENAME }),
    });

/**
 * Returns the stored session token, signing in as a guest first if there is none.
 * Mirrors Instant's signInAsGuest: no screen, no email, a real user id from the first launch.
 *
 * Works offline once there is a stored session: a camping app gets reopened with no signal,
 * and the list is already on the phone. Only the very first launch needs the network.
 */
export async function ensureSession(): Promise<{ token: string; userId: string }> {
  let token = await AsyncStorage.getItem(TOKEN_KEY);
  const cachedUserId = await AsyncStorage.getItem(USER_ID_KEY);
  if (!token) {
    const res = await fetch(`${API_URL}/api/auth/sign-in/anonymous`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    // The bearer plugin hands the session token back in this header.
    token = res.headers.get('set-auth-token');
    if (!res.ok || !token) throw new Error(`Guest sign-in failed (${res.status})`);
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
  // Spike shortcut: join the one seeded household. Idempotent on the server.
  let join: Response;
  try {
    join = await fetch(`${API_URL}/spike/join`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
  } catch (offline) {
    // No network: carry on with the session we already have, if any.
    if (cachedUserId) return { token, userId: cachedUserId };
    throw offline;
  }
  if (join.status === 401) {
    // The stored session expired or the server's database was reset: start over as a new guest.
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_ID_KEY]);
    return ensureSession();
  }
  if (!join.ok) throw new Error(`Joining the household failed (${join.status})`);
  const { userId } = (await join.json()) as { userId: string };
  await AsyncStorage.setItem(USER_ID_KEY, userId);
  return { token, userId };
}

/** How the PowerSync SDK talks to our backend: JWTs for reads, the upload endpoint for writes. */
export function createConnector(sessionToken: string): PowerSyncBackendConnector {
  return {
    async fetchCredentials() {
      const res = await fetch(`${API_URL}/api/auth/token`, {
        headers: { authorization: `Bearer ${sessionToken}` },
      });
      // Throwing (rather than returning null) tells the SDK to retry: we're probably offline.
      if (!res.ok) throw new Error(`Could not get a sync token (${res.status})`);
      const { token } = (await res.json()) as { token: string };
      return { endpoint: SYNC_URL, token };
    },

    /**
     * Sends the oldest queued transaction to the API, then marks it done.
     * A throw leaves it queued; the SDK retries, which is how offline writes land later.
     */
    async uploadData(database: CommonPowerSyncDatabase) {
      const transaction = await database.getNextCrudTransaction();
      if (!transaction) return;
      const ops = transaction.crud.map((entry) => ({
        op: entry.op,
        type: entry.table,
        id: entry.id,
        data: entry.opData,
      }));
      const res = await fetch(`${API_URL}/spike/upload`, {
        method: 'POST',
        headers: { authorization: `Bearer ${sessionToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ops }),
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      await transaction.complete();
    },
  };
}
