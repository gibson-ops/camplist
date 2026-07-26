import { useEffect, useRef } from 'react';
// Always via lib/db, never the SDK directly — that's what keeps the web fork a one-file swap.
import { db, id } from './db';

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
    isGuest: Boolean(user && (user as { isGuest?: boolean }).isGuest),
    error,
  };
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
    isReady: Boolean(household),
  };
}
