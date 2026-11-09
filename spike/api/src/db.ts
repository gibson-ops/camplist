import pg from 'pg';

/** One pool for both Better Auth's tables and the app's tables (database `camplist`). */
export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://postgres:spike@localhost:5440/camplist',
});
