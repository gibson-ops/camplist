import { useAuth } from '@clerk/expo';
import { useEffect, useRef } from 'react';
import { db, INSTANT_CLERK_CLIENT_NAME } from './db';

/**
 * Bridges a Clerk session into an InstantDB session.
 *
 * Clerk owns identity; Instant owns data + permissions. Instant can't read a Clerk cookie,
 * so we hand it Clerk's signed session JWT and it verifies the signature, reads the `email`
 * claim, and mints its own long-lived session. That Instant session is what the CEL rules
 * in instant.perms.ts evaluate `auth.id` against.
 *
 * Prerequisites (one-time, see docs/setup.md):
 *  1. Clerk dashboard → Sessions → Customize session token → add `email` + `email_verified`.
 *  2. `instant-cli auth client add --type clerk --name clerk --publishable-key pk_...`
 *
 * @returns readiness + error state for the bridge, so the UI can hold routing until the
 *          Instant session exists (not just the Clerk one).
 */
export function useInstantClerkAuth() {
  const { isLoaded: clerkLoaded, isSignedIn, getToken } = useAuth();
  const { user: instantUser, isLoading: instantLoading, error } = db.useAuth();

  // Guards against firing a second sign-in while the first is still in flight —
  // Clerk refreshes its token roughly every 45s and would otherwise re-trigger this.
  const signingIn = useRef(false);

  useEffect(() => {
    if (!clerkLoaded || instantLoading) return;

    // Signed into Clerk but not yet into Instant → exchange the token.
    if (isSignedIn && !instantUser && !signingIn.current) {
      signingIn.current = true;
      (async () => {
        try {
          const idToken = await getToken();
          if (!idToken) throw new Error('Clerk returned no session token');
          await db.auth.signInWithIdToken({
            clientName: INSTANT_CLERK_CLIENT_NAME,
            idToken,
          });
        } catch (err) {
          console.error('[instant-clerk] token exchange failed:', err);
        } finally {
          signingIn.current = false;
        }
      })();
    }

    // Signed out of Clerk but Instant still has a session → tear it down.
    if (!isSignedIn && instantUser) {
      void db.auth.signOut();
    }
  }, [clerkLoaded, isSignedIn, instantUser, instantLoading, getToken]);

  return {
    /** True once BOTH Clerk and Instant have resolved and agree the user is signed in. */
    isReady: clerkLoaded && !instantLoading && (!isSignedIn || Boolean(instantUser)),
    isSignedIn: Boolean(isSignedIn && instantUser),
    instantUser,
    error,
  };
}

/**
 * Signs out of Instant first, then Clerk — the reverse order leaves an orphaned Instant
 * session that survives until its own expiry.
 *
 * @param clerkSignOut the `signOut` function from Clerk's `useAuth()`
 */
export async function signOutEverywhere(clerkSignOut: () => Promise<unknown>) {
  await db.auth.signOut();
  await clerkSignOut();
}
