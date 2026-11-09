/**
 * Spike API: auth for the app, and the endpoint PowerSync's upload queue calls.
 *
 * Reads never come here: they stream from Postgres to each phone through the PowerSync service.
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { auth } from './auth.js';
import { pool } from './db.js';

const SPIKE_HOUSEHOLD = '6f1c1a52-0000-4000-8000-000000000001';

/** Columns a client may write, per table. Anything else in a payload is ignored. */
const WRITABLE: Record<string, readonly string[]> = {
  items: ['household_id', 'list_id', 'name', 'state', 'sort'],
  presence: ['household_id', 'list_id', 'user_id', 'name', 'seen_at'],
};

/** One entry of PowerSync's CRUD queue, as the app forwards it. */
type CrudOp = {
  op: 'PUT' | 'PATCH' | 'DELETE';
  type: string;
  id: string;
  data?: Record<string, unknown>;
};

const app = new Hono<{ Variables: { userId: string } }>();

app.get('/health', (c) => c.json({ ok: true }));
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// Everything under /spike needs a signed-in (possibly anonymous) user.
app.use('/spike/*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'unauthorized' }, 401);
  c.set('userId', session.user.id);
  await next();
});

/** Spike shortcut: every user joins the one seeded household. Real invites come later. */
app.post('/spike/join', async (c) => {
  await pool.query(
    `INSERT INTO household_members (household_id, user_id) VALUES ($1, $2)
     ON CONFLICT (household_id, user_id) DO NOTHING`,
    [SPIKE_HOUSEHOLD, c.get('userId')],
  );
  return c.json({ householdId: SPIKE_HOUSEHOLD, userId: c.get('userId') });
});

/**
 * Applies one PowerSync transaction from the app's upload queue.
 *
 * Steps:
 * 1. Load the households the caller belongs to.
 * 2. For each op, check the target row (and any new household_id) is in one of them.
 * 3. Apply all ops in one Postgres transaction.
 *
 * Validation failures answer 200 with the rejected ops. A 4xx would block the phone's
 * upload queue forever (https://docs.powersync.com/handling-writes/writing-client-changes).
 */
app.post('/spike/upload', async (c) => {
  const userId = c.get('userId');
  const { ops } = await c.req.json<{ ops: CrudOp[] }>();
  const client = await pool.connect();
  const rejected: { id: string; reason: string }[] = [];
  try {
    // Step 1: membership.
    const { rows } = await client.query<{ household_id: string }>(
      'SELECT household_id FROM household_members WHERE user_id = $1',
      [userId],
    );
    const mine = new Set(rows.map((r) => r.household_id));

    await client.query('BEGIN');
    for (const op of ops) {
      const columns = WRITABLE[op.type];
      if (!columns) {
        rejected.push({ id: op.id, reason: `table ${op.type} is not writable` });
        continue;
      }

      // Step 2: authorization, on the stored row and on the incoming one.
      const existing = await client.query<{ household_id: string }>(
        `SELECT household_id FROM ${op.type} WHERE id = $1`,
        [op.id],
      );
      const storedHousehold = existing.rows[0]?.household_id;
      const newHousehold = op.data?.household_id as string | undefined;
      if (
        (storedHousehold && !mine.has(storedHousehold)) ||
        (newHousehold && !mine.has(newHousehold))
      ) {
        rejected.push({ id: op.id, reason: 'not your household' });
        continue;
      }
      if (op.type === 'presence' && op.data?.user_id && op.data.user_id !== userId) {
        rejected.push({ id: op.id, reason: 'presence is only writable for yourself' });
        continue;
      }

      // Step 3: apply.
      const data = Object.fromEntries(
        Object.entries(op.data ?? {}).filter(([key]) => columns.includes(key)),
      );
      if (op.type === 'items' && op.op !== 'DELETE') {
        data.updated_by = userId;
        data.updated_at = new Date().toISOString();
      }
      const keys = Object.keys(data);
      const values = Object.values(data);

      if (op.op === 'DELETE') {
        await client.query(`DELETE FROM ${op.type} WHERE id = $1`, [op.id]);
      } else if (op.op === 'PUT') {
        const cols = ['id', ...keys];
        const placeholders = cols.map((_, i) => `$${i + 1}`);
        const updates = keys.map((k) => `${k} = EXCLUDED.${k}`).join(', ');
        await client.query(
          `INSERT INTO ${op.type} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})
           ON CONFLICT (id) DO ${updates ? `UPDATE SET ${updates}` : 'NOTHING'}`,
          [op.id, ...values],
        );
      } else if (keys.length > 0) {
        const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
        await client.query(`UPDATE ${op.type} SET ${sets} WHERE id = $1`, [op.id, ...values]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('upload failed', error);
    // 5xx: PowerSync retries later, which is right for a transient database error.
    return c.json({ error: 'upload failed' }, 500);
  } finally {
    client.release();
  }
  if (rejected.length) console.warn('rejected ops', userId, rejected);
  return c.json({ ok: true, rejected });
});

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, () => console.log(`spike api on :${port}`));
