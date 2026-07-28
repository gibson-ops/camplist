import { rankTrips, type TripRow, type TripShape } from './similarity';
import { slugify } from './tripMeta';
import type { ItemSeed } from './itemSeeds';

/**
 * What the household's own past trips say to pack.
 *
 * `similarity.ts` decides which past trips are like this one; this decides what that implies.
 * The two are split because the ranking has other callers — "start from a past trip", and the
 * chip seeds — and none of them care about items.
 *
 * The output is deliberately the same shape as an `itemSeeds.ts` seed plus provenance, so the
 * merge in `suggest.ts` is a concatenation rather than a translation.
 */

/** A trip row with enough of its lists loaded to say what was on them. */
export type PackedTripRow = Omit<TripRow, 'lists'> & {
  lists?: {
    /** Absent on the shared list. Its presence is what makes an item somebody's own. */
    owner?: { id: string } | null;
    sortOrder?: number | null;
    items?: {
      name: string;
      state?: string;
      sharing?: string;
      consumable?: boolean;
      sortOrder?: number | null;
      /** Set when the row is a kit rather than a thing. See why kits are skipped below. */
      group?: { id: string } | null;
    }[];
  }[];
};

/** Stored order, which the store does not hand back on its own. See `itemsOf`. */
const byOrder = (a: { sortOrder?: number | null }, b: { sortOrder?: number | null }) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

export type HistorySuggestion = ItemSeed & {
  /** Summed weight of every past trip that packed it. Comparable across suggestions, not absolute. */
  weight: number;
  /** How many past trips packed it. */
  trips: number;
  /** Where it came from, best match first — what lets a suggestion explain itself. */
  from: { id: string; name: string }[];
};

/** One item's running tally across every matching trip. */
type Tally = {
  name: string;
  weight: number;
  each: number;
  one: number;
  consumable: number;
  /** What the best-matching trip said, kept to break ties. See `majority`. */
  firstEach: boolean;
  firstConsumable: boolean;
  from: { id: string; name: string }[];
  order: number;
};

/**
 * Weighted majority, with the best-matching trip breaking ties.
 *
 * Ties are common and not rare: two trips of equal weight that disagree about whether everyone
 * brings their own towel produce one exactly. Falling back to the closer match is the only
 * tiebreak that means anything — the alternative is a coin flip that changes the shape of the
 * list depending on which trip happened to be read first.
 */
function majority(yes: number, no: number, closestMatchSaidYes: boolean): boolean {
  return yes === no ? closestMatchSaidYes : yes > no;
}

/**
 * Everything a past trip contributes about one item, collapsed to a single vote.
 *
 * COLLAPSING PER TRIP IS THE POINT. A towel on all four people's lists is one household deciding
 * one thing, not four pieces of evidence — and counting it four times would let a big family's
 * personal items bury everything that belongs to nobody in particular. The tent, which is the
 * expensive thing to forget, would sink under four toothbrushes.
 *
 * Walked in STORED ORDER, which the store does not hand back on its own. With one past trip every
 * item carries identical weight, so this order is the only thing deciding what the review screen
 * shows first — and unsorted, that's whatever the query happened to return, which can differ
 * between two renders of the same screen. Sorted, ties fall back to the order the household put
 * things in, which is both stable and meaningful.
 */
function itemsOf(trip: PackedTripRow): { name: string; each: boolean; consumable: boolean }[] {
  const seen = new Map<string, { name: string; each: boolean; consumable: boolean }>();

  for (const list of [...(trip.lists ?? [])].sort(byOrder)) {
    for (const item of [...(list.items ?? [])].sort(byOrder)) {
      // A kit is a template plus a row that stands for the box. Suggesting it as a plain item
      // would put an empty "Camp kitchen" on the list — a box with nothing in it, which reads as
      // handled and isn't. Kit CONTENTS are already absent here: they link to their parent
      // rather than to a list, on purpose.
      if (item.group) continue;

      const key = slugify(item.name);
      if (!key) continue;

      // On a personal list it's self-evidently each-their-own; on the shared list the stored
      // `sharing` still carries the older way of saying the same thing.
      const each = Boolean(list.owner) || item.sharing === 'each';
      const existing = seen.get(key);

      if (existing) {
        existing.each = existing.each || each;
        existing.consumable = existing.consumable || Boolean(item.consumable);
      } else {
        seen.set(key, { name: item.name, each, consumable: Boolean(item.consumable) });
      }
    }
  }

  return [...seen.values()];
}

export type HistoryResult = {
  /** What to pack, best evidence first. */
  items: HistorySuggestion[];
  /**
   * Every tag carried by the trips that matched — which is to say, the part of this trip that
   * history can speak to at all.
   *
   * Returned because the USEFUL half is its complement. A tag nothing in the household's history
   * carries is the genuinely new thing about this trip, and it's precisely where history has
   * nothing and the shipped seeds have everything. Without this, "history first" silently buries
   * the one suggestion that mattered. See `suggest.ts`.
   */
  covered: string[];
};

/**
 * What past trips suggest for this one, best evidence first.
 *
 * Ranked by summed match weight rather than raw frequency: something packed on the two trips that
 * genuinely resemble this one beats something packed on five that don't. Frequency alone would
 * make the household's most generic habits outrank everything specific, which is the opposite of
 * what the metadata was collected for.
 *
 * Returns EVERYTHING it found, unfiltered and untruncated — `suggest.ts` owns what's shown, since
 * the exclusions and the budget have to apply to seeds identically.
 *
 * @param current the trip being packed, already shaped
 * @param past every other trip in the household, with lists and items loaded
 * @param now injectable so the tests aren't calendar-dependent
 */
export function suggestFromHistory({
  current,
  past,
  now = Date.now(),
}: {
  current: TripShape;
  past: PackedTripRow[];
  now?: number;
}): HistoryResult {
  const rows = new Map(past.map((row) => [row.id, row]));
  const tallies = new Map<string, Tally>();
  const covered = new Set<string>();
  let order = 0;

  // Best match first, so the first spelling of an item — and the first answer about whether it's
  // shared — comes from the trip that resembles this one most.
  for (const { shape, weight } of rankTrips(current, past, now)) {
    const row = rows.get(shape.id);
    if (!row) continue;

    for (const tag of [
      ...shape.tripTypes,
      ...shape.travelModes,
      ...shape.lodgings,
      ...shape.activities,
      ...shape.conditions,
    ]) {
      covered.add(tag);
    }

    for (const item of itemsOf(row)) {
      const key = slugify(item.name);
      const tally = tallies.get(key) ?? {
        name: item.name,
        weight: 0,
        each: 0,
        one: 0,
        consumable: 0,
        firstEach: item.each,
        firstConsumable: item.consumable,
        from: [],
        order: order++,
      };

      tally.weight += weight;
      if (item.each) tally.each += weight;
      else tally.one += weight;
      if (item.consumable) tally.consumable += weight;
      tally.from.push({ id: shape.id, name: shape.name });

      tallies.set(key, tally);
    }
  }

  const items = [...tallies.values()]
    .sort((a, b) => b.weight - a.weight || b.from.length - a.from.length || a.order - b.order)
    .map((tally) => ({
      name: tally.name,
      sharing: majority(tally.each, tally.one, tally.firstEach)
        ? ('each' as const)
        : ('one' as const),
      consumable: majority(
        tally.consumable,
        tally.weight - tally.consumable,
        tally.firstConsumable,
      ),
      weight: tally.weight,
      trips: tally.from.length,
      from: tally.from,
    }));

  return { items, covered: [...covered] };
}
