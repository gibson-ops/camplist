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
export type CheckReason = 'empty' | 'charged' | 'clean' | 'serviced' | 'expired';

/** What today's `consumable: true` has always meant. */
export const DEFAULT_CHECK_REASON: CheckReason = 'empty';

/**
 * The vocabulary, in the order it's offered.
 *
 * `label` is what you pick from and describes the item. `prompt` is what the row asks you at pack
 * time and describes the CHECK — the two are worded differently on purpose, because "Runs out" is
 * a property and "topped up?" is a question. Ordered by how often it comes up rather than
 * alphabetically: depletion first because it is the case that already existed.
 */
export const CHECK_REASONS: { value: CheckReason; label: string; prompt: string }[] = [
  { value: 'empty', label: 'Runs out', prompt: 'topped up?' },
  { value: 'charged', label: 'Needs charging', prompt: 'charged?' },
  { value: 'clean', label: 'Needs washing', prompt: 'clean?' },
  { value: 'serviced', label: 'Needs servicing', prompt: 'serviced?' },
  { value: 'expired', label: 'Can expire', prompt: 'in date?' },
];

const BY_VALUE = new Map(CHECK_REASONS.map((entry) => [entry.value, entry]));

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
  const known = item.checkReason ? BY_VALUE.get(item.checkReason as CheckReason) : undefined;
  return known ?? BY_VALUE.get(DEFAULT_CHECK_REASON)!;
}

/** The question a kit row asks about one of its contents, e.g. "charged?". */
export function checkPrompt(item: { consumable?: boolean; checkReason?: string | null }) {
  return reasonOf(item)?.prompt;
}
