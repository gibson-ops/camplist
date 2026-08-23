/**
 * Whether two item names are the same item, for stopping accidental duplicates.
 *
 * DELIBERATELY NOT `slugify`. That one exists to decide whether two spellings are the same TAG, so
 * it throws away everything that isn't a letter or a digit — which would make "Tent!" the same as
 * "Tent" and "🔦 Lantern" the same as "Lantern". For items that is exactly backwards: Jared's rule
 * is that adding a differentiating character should WORK, so you can keep two similar things apart
 * on purpose. Only the differences nobody meant are collapsed:
 *
 *   - case, because "TENT" and "tent" are the same word typed in a hurry
 *   - runs of whitespace, because a double space is a typo and not a distinction
 *   - unicode composition, so an accent or emoji typed two ways compares equal to itself
 *
 * Everything else survives — punctuation, symbols, emoji — so "Tent" and "Tent (spare)" and
 * "Tent 🏕" are three different items, which is the escape hatch that makes blocking the rest safe.
 *
 * NEVER STORED. Like `slugify`, this is a comparison key and the typed name is what gets saved.
 */
export function itemKey(name: string): string {
  return name.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Whether this name is already present among `existing`.
 *
 * @param name what is being typed, before trimming
 * @param existing names already on the list or in the kit being added to
 */
export function isAlreadyPresent(name: string, existing: string[]): boolean {
  const key = itemKey(name);
  if (!key) return false;
  return existing.some((other) => itemKey(other) === key);
}
