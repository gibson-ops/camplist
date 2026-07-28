import { useEffect, useRef, useState } from 'react';
// Always via lib/db, never the SDK directly — that's what keeps the web fork a one-file swap.
import { db, id } from './db';
import { parseListPrefs } from './listPrefs';
import { parsePending, type StrandedHousehold } from './merge';
import { addPendingMerge } from './trips';

/**
 * Camp List starts logged-out-but-synced: on first launch we silently create an InstantDB
 * GUEST session, so the user can pack a trip before ever seeing an email field. The guest is
 * a real auth identity, so permissions apply normally and data syncs to the cloud.
 *
 * When they later sign in with a new email, Instant keeps the same user id and all of their
 * guest-created data comes with them. No migration step, no local-to-cloud copy.
 *
 * @returns the session state the router gates on
 */
export function useSession() {
  const { user, isLoading, error } = db.useAuth();
  const creatingGuest = useRef(false);

  useEffect(() => {
    if (isLoading || user || creatingGuest.current) return;

    // No session at all — this is a cold first launch. Make one silently.
    creatingGuest.current = true;
    db.auth
      .signInAsGuest()
      .catch((err) => console.error('[session] guest sign-in failed:', err))
      .finally(() => {
        creatingGuest.current = false;
      });
  }, [user, isLoading]);

  return {
    user,
    isReady: !isLoading && Boolean(user),
    /** True while they haven't converted to a real account yet. */
    isGuest: isGuestUser(user),
    error,
  };
}

/**
 * Whether this session is still a guest.
 *
 * Reads `type` FIRST even though `User.isGuest` looks like the obvious field. Instant declares
 * `isGuest: boolean` on the public type but never assigns it — every check inside the SDK is
 * `type === 'guest'` — so trusting the named field silently returns false for every guest alive.
 * That's the sort of bug that doesn't surface until a screen quietly shows the wrong thing to
 * everyone who hasn't signed up.
 *
 * `isGuest` is still consulted second, so this starts working on its own if Instant ever fills
 * the field in.
 */
export function isGuestUser(user?: { type?: string; isGuest?: boolean } | null): boolean {
  if (!user) return false;
  return user.type === 'guest' || user.isGuest === true;
}

/** Emails a six-digit code. Separate from verifying it so the UI can be two plain steps. */
export function sendCode(email: string) {
  return db.auth.sendMagicCode({ email: email.trim().toLowerCase() });
}

/**
 * Verifies the code and reports whether anything got left behind.
 *
 * Instant carries a guest's refresh token into this call automatically, so a guest signing in
 * with a NEW email keeps their user id and every trip comes with them — nothing to merge, and
 * that's the common case.
 *
 * The other case is the one worth handling. When the email ALREADY has an account, both
 * identities survive: the account becomes theirs and the guest is attached to it as a linked
 * guest. Everything the guest made is still permitted, but it belongs to a household the app
 * stops showing — so unless somebody writes down where it went, it is gone as far as the user can
 * tell. `created` is what tells the two apart, and the caller has the guest's household id
 * because it asked before the identity changed underneath it.
 *
 * @param guest the household and own-person this device was using a moment ago
 * @returns what got left behind, or undefined when nothing did
 */
export async function signIn({
  email,
  code,
  guest,
}: {
  email: string;
  code: string;
  guest?: StrandedHousehold;
}): Promise<{ stranded?: StrandedHousehold }> {
  const { created } = await db.auth.signInWithMagicCode({
    email: email.trim().toLowerCase(),
    code: code.trim(),
  });

  // A brand new account absorbed the guest whole; there is no second household.
  if (created || !guest?.household) return {};
  return { stranded: guest };
}

/**
 * Records a household stranded by signing in, once there's a profile to record it against.
 *
 * A HOOK RATHER THAN A CALL, because the write can't happen when the answer arrives. Sign-in
 * swaps the identity out from under the profile query, and the new user's profile may still be
 * bootstrapping — writing immediately lands the note on the GUEST's profile, which is the one
 * the app is about to stop reading. So it's held until `profileId` resolves.
 *
 * Shared by every screen that can sign someone in, so the two can't drift into one remembering
 * and the other quietly forgetting.
 *
 * @returns the setter to hand a sign-in result to
 */
export function useStrandedRecorder(profileId?: string, pending: StrandedHousehold[] = []) {
  const [stranded, setStranded] = useState<StrandedHousehold>();

  useEffect(() => {
    if (!stranded || !profileId) return;
    addPendingMerge({ profileId, pending, stranded }).finally(() => setStranded(undefined));
  }, [stranded, profileId, pending]);

  return setStranded;
}

export function signOut() {
  return db.auth.signOut();
}

/**
 * Ensures the signed-in identity has a profile and a household to write into.
 *
 * Runs client-side rather than in an engine because a login-free first launch must work
 * without a server round-trip. The permission rules allow creating a profile and a
 * membership only for yourself, so this can't be used to join someone else's household.
 *
 * Idempotent: it only writes when the query has resolved and found nothing.
 *
 * @param userId the current auth id, or undefined while the session is still resolving
 * @returns the household id once one exists, plus whether bootstrap is still settling
 */
export function useHousehold(userId?: string) {
  const { data, isLoading } = db.useQuery(
    userId
      ? { profiles: { $: { where: { '$user.id': userId } }, households: {}, personas: {} } }
      : null,
  );

  const bootstrapping = useRef(false);
  const profile = data?.profiles?.[0];
  const household = profile?.households?.[0];

  useEffect(() => {
    // Wait for a definitive answer before writing, or a slow query creates a second household.
    if (!userId || isLoading || !data || household || bootstrapping.current) return;

    bootstrapping.current = true;
    const now = new Date();
    const profileId = profile?.id ?? id();
    const householdId = id();
    const personId = id();

    db.transact([
      db.tx.profiles[profileId]
        .update({ name: 'Me', createdAt: now })
        .link({ $user: userId })
        // The denormalized access cache every permission rule reads.
        .link({ households: householdId }),

      db.tx.households[householdId].update({ name: 'My household', createdAt: now }),

      db.tx.householdMembers[id()]
        .update({ role: 'owner', joinedAt: now })
        .link({ profile: profileId, household: householdId }),

      // One person to start, so items have something to be assigned to.
      db.tx.people[personId]
        .update({ name: 'Me', householdId, createdAt: now })
        .link({ household: householdId, profile: profileId }),
    ])
      .catch((err) => console.error('[session] household bootstrap failed:', err))
      .finally(() => {
        bootstrapping.current = false;
      });
  }, [userId, isLoading, data, household, profile?.id]);

  return {
    householdId: household?.id,
    profileId: profile?.id,
    /** Guest households this account left behind, waiting to be merged in. See lib/merge.ts. */
    pendingMerge: parsePending(profile?.pendingMerge),
    /** The person record for whoever is signed in — the "mine" in "my list". */
    personId: profile?.personas?.[0]?.id,
    /** Explicit list expand/collapse overrides; see lib/listPrefs.ts. */
    listPrefs: parseListPrefs(profile?.listPrefs),
    isReady: Boolean(household),
  };
}
