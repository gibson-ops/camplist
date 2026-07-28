import { parseTags, slugify } from './tripMeta';

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
