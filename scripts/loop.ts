/**
 * Replays the learning loop against real household data, from a terminal.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE `/loop` SCREEN. The screen answers "how is it doing?" for
 * whoever is holding the phone. This answers "did that change help?", which needs the same numbers
 * before and after an edit — and reading them off a screenshot is not a measurement, it is a vibe.
 * `lib/loopMetrics.ts` is the shared brain; both are thin readers of it.
 *
 * Agent-facing on purpose: `--json`, real exit codes, no prompts, nothing interactive.
 *
 * Usage:
 *   npm run loop -- --list
 *   npm run loop -- --household <id>
 *   npm run loop -- --household <id> --json
 *
 * Exit codes: 0 fine · 1 bad usage or missing config · 2 nothing matched
 */
import { init } from '@instantdb/admin';
import { replayAll, totals } from '../mobile/lib/loopMetrics';

const APP_ID = process.env.EXPO_PUBLIC_INSTANT_APP_ID ?? '6eaf2c74-0277-43e6-a105-c642e76778a8';
const ADMIN_TOKEN = process.env.INSTANTDB_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('Set INSTANTDB_ADMIN_TOKEN (infisical-agent run --env=dev -- ...).');
  process.exit(1);
}

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? undefined : (argv[at + 1] ?? '');
};
const has = (name: string) => argv.includes(`--${name}`);

const db = init({ appId: APP_ID, adminToken: ADMIN_TOKEN });

/**
 * Everything a replay needs, and nothing else.
 *
 * `children` comes along because a kit's contents are what the check reasons live on; `owner`
 * because a personal list is what makes an item somebody's own, which the matcher reads.
 */
const TRIP_SHAPE = {
  attendees: {},
  lists: { owner: {}, items: { group: {}, children: {} } },
} as const;

/**
 * THE ADMIN SDK HANDS BACK EVERY LINK AS AN ARRAY, including the one-to-one ones the app reads as
 * a single object. `group` is `[]` on a normal item and `[{…}]` on a kit — and `[]` is TRUTHY, so
 * every `if (item.group)` in `lib/` flips the wrong way when the same code is fed admin data.
 *
 * That is not cosmetic. `itemsOf` skips kit rows with exactly that test, so unnormalized this
 * harness silently ran with HISTORY ENTIRELY DISABLED and reported seeds-only numbers as though
 * they were the real thing — a measuring instrument confidently off by the whole of what it
 * measures. It was caught only because the CLI disagreed with the screen.
 *
 * Normalized HERE rather than by loosening `lib/`, because the app is not wrong: the React SDK
 * really does return an object. The mismatch belongs to the SDK boundary, so the adapter lives at
 * the boundary.
 */
const one = <T>(link: T | T[] | null | undefined): T | null =>
  Array.isArray(link) ? (link[0] ?? null) : (link ?? null);

/* eslint-disable @typescript-eslint/no-explicit-any */
const normalizeTrip = (trip: any) => ({
  ...trip,
  lists: (trip.lists ?? []).map((list: any) => ({
    ...list,
    owner: one(list.owner),
    items: (list.items ?? []).map((item: any) => ({ ...item, group: one(item.group) })),
  })),
});

const normalizeReflection = (r: any) => ({ ...r, trip: one(r.trip), item: one(r.item) });

async function listHouseholds() {
  const { households } = await db.query({ households: { trips: {}, people: {} } });

  const rows = (households ?? [])
    .map((h: { id: string; name?: string; trips?: unknown[]; people?: unknown[] }) => ({
      id: h.id,
      name: h.name ?? '(unnamed)',
      trips: (h.trips ?? []).length,
      people: (h.people ?? []).length,
    }))
    .filter((h) => h.trips > 0)
    .sort((a, b) => b.trips - a.trips);

  if (has('json')) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  for (const h of rows) {
    console.log(`${String(h.trips).padStart(3)} trips  ${h.id}  ${h.name}`);
  }
}

async function replayHousehold(householdId: string) {
  const { trips, reflections } = await db.query({
    trips: { $: { where: { householdId } }, ...TRIP_SHAPE },
    reflections: { $: { where: { householdId } }, trip: {}, item: {} },
  });

  if (!trips?.length) {
    console.error(`No trips for household ${householdId}.`);
    process.exit(2);
  }

  const replays = replayAll({
    trips: trips.map(normalizeTrip) as never,
    reflections: (reflections ?? []).map(normalizeReflection) as never,
  });
  const all = totals(replays);

  if (has('json')) {
    console.log(JSON.stringify({ householdId, totals: all, trips: replays }, null, 2));
    return;
  }

  const pct = (n: number | null) =>
    n === null ? '  — ' : `${String(Math.round(n * 100)).padStart(3)}%`;

  console.log(`\nACROSS ${all.trips} TRIPS`);
  console.log(`  had to think of yourself   ${all.missed}`);
  console.log(`  it named for you           ${all.taken}  (${pct(all.coverage).trim()})`);
  console.log(`  offered, never taken       ${all.ignored}`);

  // Oldest first here, unlike the screen: read down the page and you are reading the loop
  // learning, which is the question a terminal is usually being asked.
  for (const r of [...replays].reverse()) {
    console.log(`\n${r.name}`);
    console.log(
      `  named ${r.taken.length}/${r.taken.length + r.missed.length} (${pct(r.coverage).trim()})` +
        `   ignored ${r.ignored.length}` +
        (r.kits.length ? `   kits ${r.kits.length}` : '') +
        (r.oneOffs.length ? `   one-offs ${r.oneOffs.length}` : ''),
    );
    if (r.missed.length) console.log(`  missed: ${r.missed.join(' · ')}`);
    if (r.regrets.length) console.log(`  wished for after: ${r.regrets.join(' · ')}`);
  }
  console.log();
}

// Wrapped rather than top-level await: this file is transformed to CJS, which has none.
async function main() {
  const household = flag('household');

  if (has('list') || !household) {
    if (!household && !has('list')) console.error('Pick one with --household <id>. Households:\n');
    await listHouseholds();
    process.exit(has('list') ? 0 : 1);
  }

  await replayHousehold(household);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
