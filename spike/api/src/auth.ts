/**
 * Better Auth for the spike.
 *
 * - anonymous: a guest account on first launch, so data syncs before anyone signs in
 *   (the same promise InstantDB's signInAsGuest made).
 * - bearer: the app keeps the session token itself; React Native has no cookie jar.
 * - jwt: short-lived JWTs for the PowerSync service, verified against /api/auth/jwks.
 */
import { betterAuth } from 'better-auth';
import { anonymous, bearer, jwt } from 'better-auth/plugins';
import { pool } from './db.js';

export const API_URL = process.env.API_URL ?? 'https://cl-api-powersync.argo.gibsonops.com';
export const SYNC_URL = process.env.SYNC_URL ?? 'https://cl-sync-powersync.argo.gibsonops.com';

export const auth = betterAuth({
  baseURL: API_URL,
  // Spike-only secret; production reads it from Infisical.
  secret: process.env.BETTER_AUTH_SECRET ?? 'camplist-powersync-spike-not-a-real-secret',
  database: pool,
  plugins: [
    anonymous(),
    bearer(),
    jwt({
      jwt: {
        issuer: API_URL,
        // PowerSync accepts only tokens whose audience is in its client_auth.audience list.
        audience: SYNC_URL,
        // PowerSync refuses JWTs older than 60 minutes; the client fetches a fresh one on reconnect.
        expirationTime: '15m',
      },
    }),
  ],
});
