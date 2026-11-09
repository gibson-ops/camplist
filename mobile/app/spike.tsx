/**
 * PowerSync spike screen: one shared list, synced through Postgres instead of InstantDB.
 *
 * What it demonstrates, in the order the spike checks it:
 * - live sync: a tick on one phone shows on another (with the measured delay);
 * - offline writes: ticks made without signal queue up and land on reconnect;
 * - presence: who else has this list open, from a synced `presence` table.
 *
 * Reached by starting Metro with EXPO_PUBLIC_POWERSYNC_SPIKE=1 (app/index.tsx redirects here).
 */
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import {
  PowerSyncContext,
  SyncStreamConnectionMethod,
  type PowerSyncBackendConnector,
  useQuery,
  useStatus,
} from '@powersync/react-native';
import { Button, ItemRow, Screen, SectionHeader, Text, useTheme, type PackState } from '../design';
import { hideSplash } from '../lib/splash';
import { nextState } from '../lib/trips';
import { createConnector, db, ensureSession, STORAGE_LABEL } from '../spike/powersync';

const HOUSEHOLD_ID = '6f1c1a52-0000-4000-8000-000000000001';
const LIST_ID = '6f1c1a52-0000-4000-8000-0000000000a1';
/** How often an open list says "still here". */
const HEARTBEAT_MS = 15_000;
/** Someone counts as here if they were seen within this window (three missed heartbeats). */
const HERE_WINDOW_MS = 45_000;
const DEVICE_NAME =
  Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : 'Web';

type ItemRowData = {
  id: string;
  name: string;
  state: PackState;
  updated_at: string | null;
  updated_by: string | null;
};
type PresenceRow = { id: string; user_id: string; name: string; seen_at: string };

export default function SpikeRoute() {
  const t = useTheme();
  const [session, setSession] = useState<{
    userId: string;
    connector: PowerSyncBackendConnector;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sign in as a guest and open the local database. Once per app launch. Syncing starts and
  // stops with the network: see useSyncWhileOnline.
  useEffect(() => {
    hideSplash();
    let cancelled = false;
    (async () => {
      try {
        const { token, userId } = await ensureSession();
        await db.init();
        if (!cancelled) setSession({ userId, connector: createConnector(token) });
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message ?? e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error || !session) {
    return (
      <Screen>
        <View style={{ paddingHorizontal: t.space.xl, gap: t.space.md }}>
          <Text variant="headline">PowerSync spike</Text>
          <Text variant="body" tone={error ? 'danger' : 'muted'}>
            {error ?? 'Signing in as a guest…'}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <PowerSyncContext.Provider value={db}>
      <SpikeList userId={session.userId} connector={session.connector} />
    </PowerSyncContext.Provider>
  );
}

function SpikeList({
  userId,
  connector,
}: {
  userId: string;
  connector: PowerSyncBackendConnector;
}) {
  const t = useTheme();
  const status = useStatus();
  const online = useOnline();
  useSyncWhileOnline(connector, online);
  const now = useNow(5_000);
  const { data: items } = useQuery<ItemRowData>(
    'SELECT id, name, state, updated_at, updated_by FROM items WHERE list_id = ? ORDER BY sort, name',
    [LIST_ID],
  );
  const { data: presence } = useQuery<PresenceRow>('SELECT * FROM presence WHERE list_id = ?', [
    LIST_ID,
  ]);
  const pending = usePendingUploads();
  const lastRemote = useRemoteChangeDelay(items, userId);
  usePresenceHeartbeat(userId, status.connected);

  const here = presence.filter((p) => now - Date.parse(p.seen_at) < HERE_WINDOW_MS);

  const advance = (item: ItemRowData) =>
    db.execute('UPDATE items SET state = ?, updated_at = ?, updated_by = ? WHERE id = ?', [
      nextState(item.state),
      new Date().toISOString(),
      userId,
      item.id,
    ]);

  const addItem = () =>
    db.execute(
      `INSERT INTO items (id, household_id, list_id, name, state, sort)
       VALUES (uuid(), ?, ?, ?, 'unpacked', ?)`,
      [HOUSEHOLD_ID, LIST_ID, `Extra from ${DEVICE_NAME} ${items.length + 1}`, items.length + 1],
    );

  // The phone's own network state decides "offline". The sync connection's state lags it by up
  // to a keepalive timeout in both directions, which is what made the first version of this
  // label say "sending" with no signal and "offline" after the signal came back.
  const waiting = pending > 0 ? ` · ${pending} waiting to send` : '';
  const connection = !online
    ? `Offline${waiting}`
    : !status.connected
      ? `Reconnecting${waiting}`
      : pending > 0
        ? `Online · sending ${pending}`
        : 'Online · in sync';

  return (
    <Screen>
      <View style={{ paddingHorizontal: t.space.xl, gap: t.space.xs, marginBottom: t.space.lg }}>
        <Text variant="label" tone="muted">
          PowerSync spike · {DEVICE_NAME} · {STORAGE_LABEL}
        </Text>
        <Text variant="headline">Mirror Lake</Text>
        <Text variant="body" tone={online && status.connected ? 'default' : 'signal'}>
          {connection}
        </Text>
        <Text variant="caption" tone="muted">
          Here now: {here.length ? here.map((p) => p.name).join(', ') : 'nobody yet'}
        </Text>
        {lastRemote !== null && (
          <Text variant="caption" tone="muted">
            Last change from another device arrived {lastRemote} ms after the server saved it
          </Text>
        )}
      </View>

      <SectionHeader title="Shared" />
      <View style={{ paddingHorizontal: t.space.xl }}>
        {items.map((item, index) => (
          <ItemRow
            key={item.id}
            name={item.name}
            state={item.state}
            note={item.updated_by && item.updated_by !== userId ? 'by someone else' : undefined}
            onAdvance={() => void advance(item)}
            isLast={index === items.length - 1}
          />
        ))}
      </View>

      <View style={{ paddingHorizontal: t.space.xl, marginTop: t.space.xl }}>
        <Button label="Add an item" variant="secondary" onPress={() => void addItem()} />
      </View>
    </Screen>
  );
}

/**
 * Whether the phone has a network, from the OS (NetInfo).
 *
 * `null` means "not known yet" and counts as online, so a cold start doesn't flash "Offline".
 */
function useOnline() {
  const net = useNetInfo();
  return net.isConnected !== false && net.isInternetReachable !== false;
}

/**
 * Keeps the sync connection in step with the network.
 *
 * Without this, a WebSocket on a vanished network stays "connected" until a keepalive times
 * out, and after the network returns the SDK waits out that dead socket before reconnecting.
 * Disconnecting on loss and connecting on return makes both transitions immediate. Queued
 * writes are kept across a disconnect; it only stops the network side.
 */
function useSyncWhileOnline(connector: PowerSyncBackendConnector, online: boolean) {
  useEffect(() => {
    if (!online) {
      void db.disconnect();
      return;
    }
    // HTTP streaming never delivered data on Android in this spike; WebSockets work.
    void db.connect(connector, { connectionMethod: SyncStreamConnectionMethod.WEB_SOCKET });
  }, [connector, online]);
}

/** A clock that re-renders the caller every `intervalMs`, for "seen in the last N seconds". */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Number of local writes not yet accepted by the API. Polled: the SDK has no event for it. */
function usePendingUploads() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = setInterval(async () => {
      const stats = await db.getUploadQueueStats();
      setCount(stats.count);
    }, 1_000);
    return () => clearInterval(timer);
  }, []);
  return count;
}

/**
 * How long another device's change took to reach this one, in ms.
 *
 * The API stamps `updated_at` when it applies a write, so this measures Postgres → PowerSync →
 * this phone. It excludes the other phone's upload, and assumes finn and the phone agree on the
 * time (both use NTP).
 */
function useRemoteChangeDelay(items: readonly ItemRowData[], userId: string) {
  const seen = useRef(new Map<string, string | null>());
  const [delay, setDelay] = useState<number | null>(null);
  useEffect(() => {
    const firstPass = seen.current.size === 0;
    for (const item of items) {
      const before = seen.current.get(item.id);
      seen.current.set(item.id, item.updated_at);
      if (firstPass || !item.updated_at || before === item.updated_at) continue;
      if (item.updated_by && item.updated_by !== userId) {
        setDelay(Date.now() - Date.parse(item.updated_at));
      }
    }
  }, [items, userId]);
  return delay;
}

/**
 * Says "I have this list open" every HEARTBEAT_MS while connected, and clears it on leaving.
 *
 * Skipped while offline: a queue of stale heartbeats would land on reconnect and claim
 * presence for time the phone was actually away.
 */
function usePresenceHeartbeat(userId: string, connected: boolean) {
  useEffect(() => {
    if (!connected) return;
    const id = `${userId}:${LIST_ID}`;
    const beat = async () => {
      const seenAt = new Date().toISOString();
      // PowerSync tables are views, so there is no upsert. Nor can `rowsAffected` say whether an
      // UPDATE matched: writes go through INSTEAD OF triggers, which always report 0. So look first.
      await db.writeTransaction(async (tx) => {
        const existing = await tx.getOptional('SELECT id FROM presence WHERE id = ?', [id]);
        if (existing) {
          await tx.execute('UPDATE presence SET seen_at = ? WHERE id = ?', [seenAt, id]);
        } else {
          await tx.execute(
            `INSERT INTO presence (id, household_id, list_id, user_id, name, seen_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, HOUSEHOLD_ID, LIST_ID, userId, DEVICE_NAME, seenAt],
          );
        }
      });
    };
    void beat();
    const timer = setInterval(() => void beat(), HEARTBEAT_MS);
    return () => {
      clearInterval(timer);
      void db.execute('DELETE FROM presence WHERE id = ?', [id]);
    };
  }, [userId, connected]);
}
