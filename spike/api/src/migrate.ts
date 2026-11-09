/** Creates Better Auth's tables (user, session, account, verification, jwks). Safe to re-run. */
import { getMigrations } from 'better-auth/db/migration';
import { auth } from './auth.js';
import { pool } from './db.js';

const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
console.log('tables to create:', toBeCreated.map((t) => t.table).join(', ') || 'none');
console.log('tables to alter:', toBeAdded.map((t) => t.table).join(', ') || 'none');
await runMigrations();
await pool.end();
