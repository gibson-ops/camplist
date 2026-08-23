/**
 * Deletes households and everything scoped to them. DRY RUN unless `--apply`.
 *
 * Browser-driven testing leaves a household behind every time the app is opened as a fresh guest,
 * and the bootstrap race that used to double-create them left more. They are indistinguishable
 * from real ones in the app, and they are noise in `scripts/loop.ts` — which is the actual reason
 * to care, since a replay is only as honest as the household it reads.
 *
 * KEEPS ARE NAMED, NOT INFERRED. There is no heuristic here for "looks like test data", on purpose:
 * the cost of guessing wrong is somebody's real trip, and a name like "Weekend at the lake" is
 * exactly as plausible real as it is fixture. The caller says what to keep and everything else goes.
 *
 * Usage:
 *   npm run prune -- --keep <id>,<id>            # dry run, prints what would go
 *   npm run prune -- --keep <id>,<id> --apply
 *
 * Exit codes: 0 fine · 1 bad usage or missing config
 */
import { init } from '@instantdb/admin';

const APP_ID = process.env.EXPO_PUBLIC_INSTANT_APP_ID ?? '6eaf2c74-0277-43e6-a105-c642e76778a8';
const ADMIN_TOKEN = process.env.INSTANTDB_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('Set INSTANTDB_ADMIN_TOKEN (infisical-agent run --env=dev -- ...).');
  process.exit(1);
}

const argv = process.argv.slice(2);
const at = argv.indexOf('--keep');
const keep = new Set(
  at === -1
    ? []
    : (argv[at + 1] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
);
const apply = argv.includes('--apply');

if (!keep.size) {
  console.error('Refusing to run without --keep. Name the households to preserve.');
  process.exit(1);
}

const db = init({ appId: APP_ID, adminToken: ADMIN_TOKEN });

/**
 * One unit of work in a transaction. The SDK does not export the type, so it is borrowed from
 * `transact`'s own signature rather than guessed at or widened to `any`.
 */
type Chunk = Extract<Parameters<typeof db.transact>[0], unknown[]>[number];

/** Entity names come from `SCOPED` at runtime, which the typed `db.tx` proxy cannot follow. */
const tx = db.tx as unknown as Record<string, Record<string, { delete: () => Chunk }>>;

/**
 * Everything carrying a denormalized `householdId`, which the CEL rules require of every
 * household-scoped record — so this list is the schema's own definition of "owned by a household"
 * rather than a guess. See the header comment in instant.schema.ts.
 */
const SCOPED = [
  'people',
  'trips',
  'lists',
  'items',
  'itemGroups',
  'groupItems',
  'reflections',
  'reminders',
] as const;

/**
 * `profiles` is deliberately NOT here. A profile belongs to a `$user`, not to a household — it is
 * the account, and the household is something it links to. Deleting one to tidy up a household
 * would be reaching into auth to clean up data. An orphaned profile costs nothing.
 */

async function main() {
  const { households } = await db.query({ households: { trips: {}, people: {} } });
  const doomed = (households ?? []).filter((h: { id: string }) => !keep.has(h.id));

  console.log(
    `${households?.length ?? 0} households · keeping ${keep.size} · removing ${doomed.length}\n`,
  );

  let rows = 0;
  for (const h of doomed as { id: string; name?: string; trips?: unknown[] }[]) {
    const counts: string[] = [];
    const txs: Chunk[] = [];

    for (const entity of SCOPED) {
      const res = await db.query({ [entity]: { $: { where: { householdId: h.id } } } });
      const found = (res as Record<string, { id: string }[]>)[entity] ?? [];
      if (found.length) counts.push(`${entity} ${found.length}`);
      rows += found.length;
      for (const row of found) txs.push(tx[entity][row.id].delete());
    }

    // Links that carry no householdId of their own, reached from the household instead.
    const linked = await db.query({
      households: { $: { where: { id: h.id } }, members: {}, invitations: {} },
    });
    const household = (linked.households ?? [])[0] as
      { members?: { id: string }[]; invitations?: { id: string }[] } | undefined;

    for (const m of household?.members ?? []) {
      txs.push(db.tx.householdMembers[m.id].delete());
      rows += 1;
    }
    for (const i of household?.invitations ?? []) {
      txs.push(db.tx.invitations[i.id].delete());
      rows += 1;
    }

    txs.push(db.tx.households[h.id].delete());
    rows += 1;

    console.log(
      `${apply ? 'deleting' : 'would delete'}  ${h.id}  ${(h.name ?? '').padEnd(16)} ` +
        `${(h.trips ?? []).length}t  ${counts.join(', ') || 'empty'}`,
    );

    if (apply) await db.transact(txs);
  }

  console.log(
    `\n${apply ? 'deleted' : 'would delete'} ${rows} rows across ${doomed.length} households.`,
  );
  if (!apply) console.log('Dry run. Re-run with --apply to do it.');
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
