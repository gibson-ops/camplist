/**
 * Ranking names against what somebody has typed so far.
 *
 * DELIBERATELY NOT `itemKey`. That decides whether two names are THE SAME THING; this decides
 * whether one is a plausible completion of the other, which is a looser question and wants a
 * looser fold. Accents are stripped here and kept there, on purpose: typing "cafe" should find
 * "Café", while "Café" and "Cafe" stay two names you are allowed to keep apart deliberately.
 *
 * Nothing here knows about trips or items, because the tag picker is the obvious second caller.
 */

/**
 * Lowercased, accent-stripped, whitespace-collapsed. FOR COMPARING, NEVER FOR STORING.
 *
 * The combining-mark range is spelled out rather than written `\p{M}` because that needs unicode
 * property escapes, and this string is folded on every keystroke on whatever engine the device
 * happens to ship. U+0300–U+036F is the Latin accent block, which is the case that actually comes
 * up; a name in a script this misses still matches on every tier except the accent-insensitive
 * part of one.
 */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * How a name matches, best first. The tier decides the order before anything else does, so a name
 * that simply starts with what you typed always beats a cleverer match.
 */
const STARTS = 0;
const WORD = 1;
const CONTAINS = 2;
const LOOSE = 3;
const NONE = 4;

/**
 * The shortest query allowed to match loosely.
 *
 * One or two letters match a subsequence of almost everything — "ae" is inside half a packing
 * list — so below this the looser tier is more noise than help. Three is where an abbreviation
 * starts being an abbreviation of something.
 */
const LOOSE_MIN = 3;

/** Word boundaries, so "lantern" is findable inside "🔦 Lantern" and "bag" inside "sleeping-bag". */
const BOUNDARY = /[\s\-–—_/(),.]+/;

/**
 * Whether every letter of `query` appears in `name`, in order.
 *
 * Catches abbreviated typing — "hdlmp" finds "Headlamp" — which is what one-handed entry in the
 * dark actually looks like. It does NOT catch transpositions ("tetn" for "tent"): that needs an
 * edit distance, which is a threshold to tune rather than a rule to state, and is worth adding
 * only if dropped letters turn out not to be the common miss.
 */
function isSubsequence(query: string, name: string): boolean {
  let at = 0;
  for (const char of name) {
    if (char === query[at]) at += 1;
    if (at === query.length) return true;
  }
  return false;
}

/** Which tier `name` matches `query` at, both already folded. `NONE` means it doesn't. */
function tierOf(query: string, name: string): number {
  if (name.startsWith(query)) return STARTS;
  if (name.split(BOUNDARY).some((word) => word.startsWith(query))) return WORD;
  if (name.includes(query)) return CONTAINS;
  if (query.length >= LOOSE_MIN && isSubsequence(query, name)) return LOOSE;
  return NONE;
}

/**
 * The rows that could be what's being typed, best first.
 *
 * Ordered by match tier, then by `weight`, then by length. WEIGHT BEFORE LENGTH is the part worth
 * stating: typing "hea" against a household that owns a headlamp, a head net and a heater should
 * offer the headlamp, and length alone would answer "heater" — the shortest word rather than the
 * one they mean. Length only breaks ties between names with equal evidence behind them, where the
 * shorter one is the likelier thing to be finishing. Name is the last tiebreak so the order can't
 * shift between two renders of the same query — compared by code unit rather than `localeCompare`,
 * because collation differs between Hermes and a browser and this list must not.
 *
 * An empty query returns nothing rather than everything: a completion list with nothing to
 * complete is a menu, and this sits under a field somebody is about to type in.
 *
 * @param query what has been typed, unfolded
 * @param rows candidates. `weight` is how much the caller believes in each — how many trips
 *             packed it, say — and is optional so a caller with no evidence can pass bare names
 * @param limit how many to keep
 */
export function rankNames<T extends { name: string; weight?: number }>(
  query: string,
  rows: T[],
  limit: number,
): T[] {
  const needle = fold(query);
  if (!needle) return [];

  return rows
    .map((row) => ({ row, tier: tierOf(needle, fold(row.name)) }))
    .filter((hit) => hit.tier !== NONE)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        (b.row.weight ?? 0) - (a.row.weight ?? 0) ||
        a.row.name.length - b.row.name.length ||
        (a.row.name < b.row.name ? -1 : 1),
    )
    .slice(0, limit)
    .map((hit) => hit.row);
}
