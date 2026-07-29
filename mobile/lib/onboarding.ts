/**
 * Whether to show first-run onboarding, and the one question it can't answer on its own.
 *
 * `profiles.onboardedAt` was added after people were already using the app, so "no flag" does NOT
 * mean "new". Every account that existed before the field did reads as brand new, and the rule
 * that was supposed to protect returning users is the thing that ambushes them — Jared refreshed,
 * got a welcome screen, signed into an account he was already signed into, and landed straight
 * back on the welcome screen.
 *
 * That last part is worth naming, because it's a shape and not a typo: two screens that each
 * redirect to the other have no brake. Welcome sent him home, home saw no flag and sent him back.
 * A loop like that can only be fixed by making one of them stop deciding, which is why the
 * evidence below is checked BEFORE any redirect rather than after it.
 */

export type OnboardingStep =
  /** The answer isn't in yet. Redirecting now is how a returning user gets a welcome screen. */
  | 'wait'
  /** Nothing here and no record of them: a real first run. */
  | 'show'
  /** They were here before the flag was. Answer it permanently instead of asking. */
  | 'backfill'
  /** Already answered. */
  | 'skip';

/**
 * What to do about onboarding, given what's actually known right now.
 *
 * TRIPS ARE THE EVIDENCE, and they outrank the missing flag. A household with trips on it has
 * self-evidently used this app, whatever the profile does or doesn't record — so the flag gets
 * written rather than the question asked. That makes the gap self-healing: everyone who predates
 * the field is stamped the first time they open the app, and nobody is asked twice.
 *
 * `wait` is returned generously, and that's deliberate. Every other answer causes a navigation,
 * and a navigation made on incomplete information is exactly the bug this exists to fix: the cost
 * of waiting a frame is nothing, and the cost of guessing is showing a five-year customer a
 * welcome screen.
 *
 * @param needsOnboarding profile has no `onboardedAt`; undefined while the profile is loading
 * @param tripsLoaded whether the trip query has resolved — an empty array and "not yet" look
 *                    identical from a count alone, and they mean opposite things here
 * @param tripCount how many trips the household has
 */
export function onboardingStep({
  needsOnboarding,
  tripsLoaded,
  tripCount,
}: {
  needsOnboarding?: boolean;
  tripsLoaded: boolean;
  tripCount: number;
}): OnboardingStep {
  if (needsOnboarding === undefined) return 'wait';
  if (needsOnboarding === false) return 'skip';
  if (!tripsLoaded) return 'wait';
  return tripCount > 0 ? 'backfill' : 'show';
}
