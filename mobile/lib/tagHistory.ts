import { parseTags, slugify } from './tripMeta';
import { rankTrips, type TripRow, type TripShape } from './similarity';

/**
 * What this household actually tags trips with, most-used first.
 *
 * This is the seed of the learning loop, doing the cheapest useful version of it: a household
 * that has written "Rockhounding" once should be offered that spelling forever, ahead of
 * anything the app ships. Ranking by count means the tags they lean on float up on their own,
 * without anyone maintaining a list.
 *
 * Computed client-side over trips already in the query cache rather than stored. A household
 * has tens of trips, so counting strings costs nothing, and a stored count would be one more
 * thing to keep true. The moment a tag needs to carry actual DATA — "implies these items", a
 * category, a hidden flag — it earns a table and this function goes away.
 *
 * Ties break on first appearance, so the ordering is stable between renders rather than
 * shuffling every time two tags are used the same number of times.
 *
 * @param trips every trip in the household, tags unvalidated as they come out of `i.json()`
 * @param kind which tag field to count
 * @returns distinct spellings, most-used first
 */
export function tagsInUse(
  trips: { activities?: unknown; conditions?: unknown }[],
  kind: 'activities' | 'conditions',
): string[] {
  const counts = new Map<string, { label: string; count: number; first: number }>();
  let seen = 0;

  for (const trip of trips) {
    for (const tag of parseTags(trip[kind])) {
      const key = slugify(tag);
      const existing = counts.get(key);
      // First spelling seen wins the display, matching how `canonicalTag` settles ties.
      if (existing) existing.count += 1;
      else counts.set(key, { label: tag, count: 1, first: seen++ });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .map((entry) => entry.label);
}

/** The tag axes a trip can be seeded from. `tripTypes` is excluded: it's the key, not a result. */
export type TagAxis = 'lodgings' | 'activities' | 'conditions' | 'travelModes' | 'tripTypes';

/**
 * What this household tags trips LIKE THIS ONE with, best evidence first.
 *
 * The distinction from `tagsInUse` is the whole point, and it's the same one that separates item
 * history from item seeds. A household that camps in the summer and flies to conferences has
 * written "Presenting" plenty of times; ranking by raw count would offer it on a camping trip,
 * because raw count can't tell the two halves of their life apart. Weighting by how much a past
 * trip resembles this one can.
 *
 * Falls to nothing when no past trip clears the match floor, which is correct — a household with
 * no comparable trip has no opinion to offer, and the shipped seeds are what that case is for.
 *
 * @param current the trip being described
 * @param past every other trip in the household
 * @param axis which tag field to read
 * @param now injectable so the tests aren't calendar-dependent
 */
export function tagsLikeThisTrip({
  current,
  past,
  axis,
  now = Date.now(),
}: {
  current: TripShape;
  past: TripRow[];
  axis: TagAxis;
  now?: number;
}): string[] {
  const weights = new Map<string, { label: string; weight: number; first: number }>();
  let seen = 0;

  for (const { shape, weight } of rankTrips(current, past, now)) {
    for (const tag of shape[axis]) {
      const key = slugify(tag);
      const existing = weights.get(key);
      // Best-matching trip first, so its spelling is the one that shows.
      if (existing) existing.weight += weight;
      else weights.set(key, { label: tag, weight, first: seen++ });
    }
  }

  return [...weights.values()]
    .sort((a, b) => b.weight - a.weight || a.first - b.first)
    .map((entry) => entry.label);
}
