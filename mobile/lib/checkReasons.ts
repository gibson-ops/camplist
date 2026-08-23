/**
 * Why a thing inside a kit needs a look before you trust it.
 *
 * `consumable` — "can run out" — was the only reason a kit gated, which is why propane blocks a
 * camp kitchen and a skillet doesn't. Jared's observation is that depletion is one instance of a
 * broader idea: a thing can be present in the box and still not usable. Batteries need charging,
 * towels need washing, a stove needs its jet cleaned, a first aid kit has expiry dates.
 *
 * ONE REASON PER ITEM, deliberately. Not a set of booleans, because the reason is not bookkeeping —
 * it is what the check screen says out loud, and "Lantern — charged?" is a different instruction
 * from "Lantern — check". A list of flags would have to be collapsed into one word to be spoken
 * anyway, and picking the word is the interesting part.
 *
 * ADDITIVE TO `consumable`, NOT A REPLACEMENT. `consumable` still means "this needs a look" and
 * still drives the gate; this only says why. Trading a boolean for an enum properly is a migration
 * and a schema change on live data, and none of that is needed to start saying the right word.
 * `reasonOf` is where the two meet: no reason recorded means `empty`, which is exactly what
 * `consumable` meant on its own.
 */
export type CheckReason =
  'present' | 'empty' | 'charged' | 'clean' | 'serviced' | 'expired' | 'other';

/** What today's `consumable: true` has always meant. */
export const DEFAULT_CHECK_REASON: CheckReason = 'empty';

/**
 * The vocabulary, in the order it's offered.
 *
 * THREE WORDINGS PER REASON, because the row is saying three different things at three moments:
 *
 *   `label`  describes the ITEM, and is what you pick from — "Needs charging".
 *   `ask`    is the open question, before you have looked — "charged?".
 *   `done`   is the same fact asserted, once you have — "charged".
 *
 * The last two are the same word with and without a question mark for most reasons, and that is
 * the point rather than an accident: a row that still asks after you have answered it reads as
 * not having heard you. Jared's note — "it would be nice to change from question to statement
 * when checking a needs attention item".
 *
 * Ordered by how often it comes up rather than alphabetically: depletion first because it is the
 * case that already existed.
 */
export const CHECK_REASONS: { value: CheckReason; label: string; ask: string; done: string }[] = [
  /**
   * PRESENCE IS JUST ANOTHER REASON, which is the observation that makes a kit make sense.
   *
   * "Kit" was doing two jobs: a box that travels as a unit and never opens between trips (the camp
   * kitchen, whose contents genuinely need no checking), and a set of things that usually live
   * together but DISPERSE into daily life — a laptop bag, where the charger is on a desk all week
   * and the whole value of the kit is being reminded what should be back in it.
   *
   * Only the second kind needs a content check, and it needs it every trip regardless of condition.
   * That is also the honest answer to which items gate a kit: not the consumables, but the ones
   * that leave.
   */
  { value: 'present', label: 'Leaves the kit', ask: 'in the bag?', done: 'in the bag' },
  { value: 'empty', label: 'Runs out', ask: 'stocked?', done: 'stocked' },
  { value: 'charged', label: 'Needs charging', ask: 'charged?', done: 'charged' },
  { value: 'clean', label: 'Needs washing', ask: 'clean?', done: 'clean' },
  { value: 'serviced', label: 'Needs servicing', ask: 'serviced?', done: 'serviced' },
  { value: 'expired', label: 'Can expire', ask: 'in date?', done: 'in date' },
  /**
   * THE ESCAPE HATCH, and the only one that says nothing.
   *
   * Two goes at wording this ("Needs replacing", then "Wears out") were both wrong for the case
   * that prompted it — a water filter, where you are not replacing it and it is not exactly
   * wearing out, you just want to know it is still fine. The honest answer is that some checks
   * have no useful one-word name, and inventing one puts a word on the row that is more wrong
   * than no word at all.
   *
   * So its only behavior is that it is not checked by default. Empty wordings, and `checkPrompt`
   * returns nothing rather than an empty string, so the row simply carries no note.
   */
  { value: 'other', label: 'Other', ask: '', done: '' },
];

const BY_VALUE = new Map(CHECK_REASONS.map((entry) => [entry.value, entry]));

/**
 * Values this app has written before, and what they mean now.
 *
 * 'replace' shipped for a few hours as "Needs replacing" and then "Wears out"; both were wrong and
 * the answer turned out to be that the case has no good word. Anything already marked with it means
 * "checked, reason unstated", which is exactly `other` — so it maps rather than falling back to
 * depletion, which would put the wrong word on somebody's water filter.
 */
const ALIASES: Record<string, CheckReason> = { replace: 'other' };

/**
 * The reason to show for an item, tolerating everything that predates the field.
 *
 * Every item marked `consumable` before this existed has no reason recorded, and an unrecognized
 * string could arrive from a client older or newer than this one. Both fall back to `empty` rather
 * than showing nothing: a check with no word on it is the state this feature exists to end.
 *
 * @param item `consumable` is the gate; `checkReason` is optional and may be anything
 * @returns the reason, or undefined when the item isn't checked at all
 */
export function reasonOf(item: { consumable?: boolean; checkReason?: string | null }) {
  if (!item.consumable) return undefined;
  const recorded = item.checkReason ? (ALIASES[item.checkReason] ?? item.checkReason) : undefined;
  const known = recorded ? BY_VALUE.get(recorded as CheckReason) : undefined;
  return known ?? BY_VALUE.get(DEFAULT_CHECK_REASON)!;
}

/**
 * What a kit row says about one of its contents.
 *
 * @param checked whether this one has been confirmed — an answered check states the fact
 *                ("charged") where an open one asks for it ("charged?")
 * @returns the wording, or undefined when the item isn't checked at all
 */
export function checkPrompt(
  item: { consumable?: boolean; checkReason?: string | null },
  checked = false,
) {
  const reason = reasonOf(item);
  if (!reason) return undefined;
  // `other` carries no wording, and an empty string on the row is worse than nothing.
  return (checked ? reason.done : reason.ask) || undefined;
}
