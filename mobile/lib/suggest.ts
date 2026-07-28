import { SUGGESTION_BUDGET, suggestItems, type ItemSeed } from './itemSeeds';
import { suggestFromHistory, type PackedTripRow } from './itemHistory';
import { shapeOf } from './similarity';
import type { Verdicts } from './reflections';
import { slugify, tagsOf } from './tripMeta';

/**
 * The one thing screens ask for a packing list.
 *
 * Two sources answer it and they are not equal. `itemHistory.ts` reads what this household
 * actually packed on trips like this one; `itemSeeds.ts` reads a table written by hand. History
 * wins wherever it has something to say — it knows that this family takes a percolator and that
 * nobody here has ever wanted a hammock, and no amount of curating a shipped list gets there.
 *
 * Merging in one place matters because the two sources have to agree about exclusions, about the
 * sharing filter, and about the budget. Doing it at each call site is how the add sheet and the
 * review screen drift into suggesting different things for the same trip.
 */

export type Suggestion = ItemSeed & {
  /**
   * Past trips that packed it, best match first. EMPTY MEANS THE APP IS GUESSING.
   *
   * Kept on the way out because it's the difference between "you took this last time" and "trips
   * like this usually need one", and those earn very different amounts of trust. A suggestion
   * that can name its source is one you can accept at a glance or dismiss with a reason.
   */
  from: { id: string; name: string }[];
};

/**
 * The most a trip's NEW tags can take of the budget.
 *
 * A cap is needed in one direction only. Adding three activities the household has never done
 * before produces nine seeds, and without a ceiling they'd take the whole screen and push the
 * tent — which this family has packed on every trip for four years — off the bottom of it.
 * Half leaves both halves of the trip represented.
 */
const NOVEL_SHARE = 0.5;

/**
 * What to suggest for a trip, best first.
 *
 * @param trip the trip being packed, as it comes out of the query
 * @param past every OTHER trip in the household, with lists and items loaded. Trips that don't
 *             resemble this one are dropped inside the matcher, not here
 * @param onList item names already on the trip — suggesting something written down is noise
 * @param dismissed names turned down; see `dismissedNames` for how one earns its way here
 * @param sharing narrow to one kind, which is how a sheet opened under a person's list knows
 *                that a cooler isn't theirs
 * @param verdicts what post-trip notes say to push up or down; see `verdictsFrom`
 * @param now injectable so the tests aren't calendar-dependent
 */
export function suggestFor({
  trip,
  past,
  onList = [],
  dismissed = [],
  verdicts,
  sharing,
  limit = SUGGESTION_BUDGET.inline,
  now = Date.now(),
}: {
  trip: PackedTripRow;
  past: PackedTripRow[];
  onList?: string[];
  dismissed?: string[];
  verdicts?: Verdicts;
  sharing?: 'one' | 'each';
  limit?: number;
  now?: number;
}): Suggestion[] {
  const excluded = new Set([...onList, ...dismissed].map(slugify));
  const tags = tagsOf(trip);

  const { items, covered } = suggestFromHistory({ current: shapeOf(trip, now), past, now });
  const history: Suggestion[] = items
    .filter((item) => !excluded.has(slugify(item.name)))
    .filter((item) => !sharing || (item.sharing ?? 'one') === sharing)
    .map(({ name, sharing: itemSharing, consumable, from }) => ({
      name,
      sharing: itemSharing,
      consumable,
      from,
    }));

  /**
   * Tags nothing in the household's history carries — the genuinely new part of this trip.
   *
   * These lead the list, ahead of history, and the reason is what a suggestion is FOR. History's
   * best answers are the things this family packs every single time, which are also the things
   * they are least likely to forget; the tent has never once been left behind. The first time
   * they tick "Fishing", the rod is the only thing on the screen anybody could actually forget.
   * Ranking by confidence would put it last. Ranking by what's worth saying puts it first.
   */
  const known = new Set(covered.map(slugify));
  const novel = tags.filter((tag) => !known.has(slugify(tag)));

  const seedsFor = (forTags: string[], spokenFor: string[]) =>
    suggestItems(
      { tags: forTags, onList: [...onList, ...spokenFor], dismissed, sharing },
      limit,
    ).map((seed) => ({ ...seed, from: [] as { id: string; name: string }[] }));

  const fromNovel = novel.length
    ? seedsFor(
        novel,
        history.map((item) => item.name),
      ).slice(0, Math.floor(limit * NOVEL_SHARE))
    : [];

  // Everything already offered counts as spoken for, so the two sources can't put the same thing
  // on the screen twice under two different justifications.
  const spokenFor = [...history, ...fromNovel].map((item) => item.name);
  const rest = seedsFor(tags, spokenFor);

  /**
   * What somebody said out loud after a trip like this one.
   *
   * LEADS EVERYTHING, above even a novel tag's gear, because it's the only input in the system
   * that came from a person rather than an inference. "I wished I'd had a second lantern" is not
   * a guess the app is making; it's a request, and burying a request under the app's own
   * reasoning is how a product stops feeling like it listens.
   *
   * It's also the only source that can name something no list has ever held, which is exactly
   * what history is structurally unable to produce.
   */
  const wished: Suggestion[] = (verdicts?.promoted ?? [])
    .filter((seed) => !excluded.has(slugify(seed.name)))
    .filter((seed) => !sharing || (seed.sharing ?? 'one') === sharing)
    .map((seed) => ({ ...seed, from: [] }));

  const spoken = new Set(wished.map((seed) => slugify(seed.name)));
  const sunk = new Set((verdicts?.demoted ?? []).map(slugify));
  const rank = (item: Suggestion) => (sunk.has(slugify(item.name)) ? 1 : 0);

  // A stable partition rather than a sort: demoted things sink to the back and keep their order
  // among themselves.
  //
  // SUNK, NOT SILENCED, and the difference is what the budget does to each. A silenced name is
  // gone at any budget; a sunk one comes back the moment there's room, and only falls off when
  // something better needs the slot. That's the right weight for one observation from one trip —
  // enough to lose an argument with better evidence, not enough to win one on its own.
  const body = [...fromNovel, ...history, ...rest].filter(
    (item) => !spoken.has(slugify(item.name)),
  );

  return [...wished, ...body.filter((i) => !rank(i)), ...body.filter(rank)].slice(0, limit);
}
