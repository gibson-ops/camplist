import { itemKey } from './itemKey';

/**
 * Every name this household has ever written down — its vocabulary, not its recommendations.
 *
 * SEPARATE FROM `itemHistory.ts` AND NOT A WEAKER VERSION OF IT. That module answers "what should
 * this trip pack?", so it weighs trips by how much they resemble this one, drops what somebody
 * opted out of, and stays silent about anything it can't justify. This answers "what does this
 * household call things?", which is a question about spelling rather than about gear, and the two
 * disagree on purpose:
 *
 *   - EVERY trip counts equally. A name you used once on a trip nothing resembles is still a name
 *     you used, and it is exactly the one you'd struggle to retype.
 *   - `oneOff` items ARE included. That flag means "never suggest this again", and completing
 *     something already being typed is not a suggestion — you have said what you want, and the
 *     app declining to spell it would be withholding, not restraint.
 *   - Kit ROWS are excluded, for the same reason `itemsOf` excludes them: the name stands for a
 *     container, and adding it as a plain item produces an empty "Camp kitchen" that reads as
 *     handled and isn't. Kit CONTENTS are included — a skillet is a thing whatever it lives in.
 *
 * The payoff is bigger than saved keystrokes. Suggestions match past items by `slugify`, so
 * "Head lamp" and "Headlamp" are two different histories that each know half of what the household
 * does. Offering the spelling already in use is what makes the names converge, and converged names
 * are what the learning loop is reading.
 */

/** A trip with enough of its lists loaded to say what was written on them. */
export type NamedTripRow = {
  lists?: {
    items?: {
      name: string;
      /** Set when the row stands for a kit rather than a thing. Excluded — see above. */
      group?: { id: string } | null;
      /** A kit's contents, which live under the row rather than on the list. */
      children?: { name: string }[];
    }[];
  }[];
};

export type KnownName = {
  /** The spelling to offer, which is the one the household writes most often. */
  name: string;
  /** `itemKey(name)`, so callers can exclude what's already present without re-deriving it. */
  key: string;
  /** How many trips wrote it. Feeds `rankNames`, where it decides ties. */
  weight: number;
};

/**
 * Every distinct name across these trips, with how many trips used it.
 *
 * COUNTED PER TRIP, NOT PER ROW. A towel on all four people's lists is one household using one
 * word, and counting it four times would rank a big family's personal items above everything that
 * belongs to nobody in particular — the same bias `itemsOf` collapses for the same reason.
 *
 * Spellings are grouped by `itemKey`, which is the SAME key the duplicate guard compares with, so
 * the corpus and the guard can never disagree about what counts as the same name. Where a
 * household has written it more than one way, the most-used spelling wins and alphabetical order
 * breaks the tie — arbitrary, but stable, which is what stops the offered spelling flickering
 * between two renders.
 *
 * @param trips every trip in the household, including the one being packed. The current trip
 *              belongs here: something added to another list an hour ago is exactly the name you
 *              are about to want again.
 */
export function nameCorpus(trips: NamedTripRow[]): KnownName[] {
  const known = new Map<string, { trips: number; spellings: Map<string, number> }>();

  for (const trip of trips) {
    // Which names this trip used at all. A Set of KEYS, so the trip counts once however many
    // lists carried the word and however it was spelled on each.
    const seen = new Set<string>();

    const record = (name: string) => {
      const key = itemKey(name);
      if (!key) return;
      seen.add(key);

      // Spellings are counted per OCCURRENCE, deliberately unlike the trip count. Deduping them
      // per trip would make the winner depend on which row the query happened to return first,
      // and the query does not promise an order. Counting every occurrence asks a question that
      // has the same answer whatever order they arrive in: which spelling does this household
      // write more often?
      const entry = known.get(key) ?? { trips: 0, spellings: new Map<string, number>() };
      const spelling = name.trim();
      entry.spellings.set(spelling, (entry.spellings.get(spelling) ?? 0) + 1);
      known.set(key, entry);
    };

    for (const list of trip.lists ?? []) {
      for (const item of list.items ?? []) {
        if (!item.group) record(item.name);
        // Only a kit row carries children, so this is a no-op for everything else.
        for (const child of item.children ?? []) record(child.name);
      }
    }

    for (const key of seen) {
      const entry = known.get(key);
      if (entry) entry.trips += 1;
    }
  }

  return [...known.entries()].map(([key, entry]) => ({
    key,
    name: [...entry.spellings.entries()].sort(
      // Code-unit order, not `localeCompare`: collation differs between Hermes and a browser, and
      // the offered spelling is written to the list — it cannot depend on which engine asked. The
      // side effect is that a capitalized spelling wins a tie, which is the one a name should have.
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
    )[0][0],
    weight: entry.trips,
  }));
}
