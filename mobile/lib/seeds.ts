/**
 * What the app offers before it knows anything about you.
 *
 * SEEDS, NOT DEFINITIONS. These lists exist to make the first trip useful when there's no
 * history to learn from, and to keep a household's spellings converging. They are not an
 * enumeration of the space — no such enumeration finishes. Every axis accepts anything, and
 * once a household has history, history outranks everything here.
 *
 * Two layers, and the distinction matters:
 *
 *   • POOLS are as long as we can make them. They cost nothing on screen — they're the browse
 *     list behind the `+`, reached by search. More is strictly better.
 *   • SEEDS are what shows without opening anything, capped at six. That budget is the whole
 *     reason the form is readable.
 *
 * Camping is the center of gravity and has the deepest seeds (see PRODUCT.md), but nothing in
 * this file assumes a tent.
 */

import { canonicalTag, dedupeTags, seasonOf, slugify } from './tripMeta';

/**
 * What kind of trip this is. The seed key: it decides which lodging, activities and conditions
 * get offered first, so it belongs at the top of the form.
 *
 * Deliberately NOT a list of bundles like "backcountry hunting weekend". Those are
 * combinatorial, never finish being curated, and are already computable — the answer to "give
 * me a lot in one tap" is starting from a past trip, not a taxonomy someone has to maintain.
 *
 * A type nobody seeded (a festival, a tournament, a funeral) simply gets the generic seeds on
 * its first trip and the household's own history from the second. That degradation is the
 * whole reason this doesn't need to be exhaustive.
 */
export const TRIP_TYPES = ['Camping', 'Vacation', 'Visiting people', 'Work', 'Event'];

/**
 * How you get there. Its own axis because flying constrains a list harder than almost anything
 * else — liquids, bag weight, nothing with fuel in it, adapters — and none of that is implied
 * by where you're sleeping.
 *
 * The compound "Train or boat" that used to sit here was a catch-all papering over a set that
 * was never closed. They're separate now, and a motorcycle or a bike tour is one tap away.
 */
export const TRAVEL = ['Driving', 'Flying', 'Train', 'Boat'];

/**
 * Where you sleep. The old `setting` field widened past camping: it decides the sleep system,
 * the towels, the toiletries and whether there's a kitchen.
 *
 * Backpacking earns its own entry rather than folding into Tent — carrying everything on your
 * back is the sharpest packing constraint the app knows about.
 */
export const LODGING = [
  'Tent',
  'Backpacking',
  'Dispersed',
  'RV or trailer',
  'Cabin',
  'Rental',
  'Hotel',
  'With family or friends',
  'Hostel',
  'Van',
];

/**
 * The generic lodging seeds, for a trip type nobody wrote a list for.
 *
 * Deliberately NOT the whole of `LODGING`: falling back to every option would break the same
 * six-chip budget the funnel exists to enforce, which is exactly what a test caught.
 */
const LODGING_FALLBACK = ['Hotel', 'Rental', 'With family or friends', 'Tent', 'Cabin'];

/** Lodging worth offering first for each kind of trip. Everything else is behind the `+`. */
const LODGING_BY_TYPE: Record<string, string[]> = {
  camping: ['Tent', 'Backpacking', 'Dispersed', 'RV or trailer', 'Cabin'],
  vacation: ['Hotel', 'Rental', 'Cabin', 'With family or friends'],
  'visiting-people': ['With family or friends', 'Hotel', 'Rental'],
  work: ['Hotel', 'Rental'],
  event: ['Hotel', 'Rental', 'With family or friends'],
};

/**
 * The activity chips shown first, per trip type.
 *
 * Six-ish each, on purpose. Twenty-eight chips on one screen is a wall nobody reads, and the
 * long tail is one tap away behind the `+`. Once a household has history these give way to
 * what it actually tags on trips like this one.
 */
const ACTIVITIES_BY_TYPE: Record<string, string[]> = {
  camping: ['Hiking', 'Fishing', 'Paddling', 'Real cooking', 'Stargazing', 'Keeping kids busy'],
  vacation: ['Beach', 'Hiking', 'Swimming', 'Sightseeing', 'Eating out', 'Keeping kids busy'],
  'visiting-people': ['Keeping kids busy', 'Eating out', 'Sightseeing', 'Helping out'],
  work: ['Presenting', 'Conference', 'Client dinner', 'Working out'],
  event: ['Ceremony', 'Reception', 'Photos', 'Working out'],
};

/** The generic seeds, used for a trip type nobody wrote a list for. */
const ACTIVITIES_FALLBACK = ['Hiking', 'Swimming', 'Eating out', 'Sightseeing', 'Working out'];

/** Shipped, but not a first-line seed anywhere. Browsable behind the `+`. */
const MORE_ACTIVITIES = [
  // Outdoors
  'Biking',
  'Mountain biking',
  'Climbing',
  'Bouldering',
  'Hunting',
  'Shooting',
  'OHV',
  'Skiing',
  'Snowboarding',
  'Snowshoeing',
  'Sledding',
  'Kayaking',
  'Rafting',
  'Sailing',
  'Surfing',
  'Snorkeling',
  'Diving',
  'Horseback riding',
  'Rockhounding',
  'Foraging',
  'Birding',
  'Trail running',
  'Backpacking',
  'Geocaching',
  // Town and indoors
  'Golf',
  'Running',
  'Yoga',
  'Photography',
  'Board games',
  'Reading',
  'Live music',
  'Museums',
  'Shopping',
  'Brewery or winery',
  'Hot springs',
  'Spa',
  'Amusement park',
  'Sports game',
  // Obligations
  'Working remotely',
  'Studying',
  'Cooking a meal for others',
  'Helping with a project',
];

/**
 * What you're up against. Weather mostly, but constraints count too — "Formal dress" predicts
 * a garment bag as reliably as "Cold nights" predicts a warmer bag.
 *
 * Phrased as EXPECTATIONS, because this is filled in while planning and a forecast that far
 * out is a guess. The post-trip reflection is where reality gets recorded.
 */
const CONDITIONS_BY_TYPE: Record<string, string[]> = {
  camping: ['Cold nights', 'Hot days', 'Rain likely', 'Buggy', 'No hookups', 'Bear country'],
  vacation: ['Hot days', 'Rain likely', 'Humid', 'Lots of walking', 'Sun exposure'],
  'visiting-people': ['Cold nights', 'Hot days', 'Staying in a spare room', 'Pets in the house'],
  work: ['Formal dress', 'Long flight', 'Time zone change', 'Early mornings'],
  event: ['Formal dress', 'Hot days', 'Rain likely', 'Lots of walking'],
};

const CONDITIONS_FALLBACK = ['Cold nights', 'Hot days', 'Rain likely', 'Lots of walking'];

const MORE_CONDITIONS = [
  // Weather and ground
  'Snow',
  'Icy roads',
  'Wind',
  'Cold rain',
  'Wildfire smoke',
  'Sun exposure',
  'Muddy',
  'Dusty',
  'Thunderstorms',
  'Short days',
  // Terrain and facilities
  'High altitude',
  'No water source',
  'No hookups',
  'No power',
  'No cell service',
  'Fire ban',
  'Bear country',
  'Shared bathroom',
  'No laundry',
  'Laundry available',
  'Long drive',
  'Long flight',
  'Time zone change',
  // Constraints
  'Formal dress',
  'Early mornings',
  'Late nights',
  'Bag weight limit',
  'Carry-on only',
  'Someone has allergies',
  'Traveling with a baby',
  'Traveling with a dog',
  'Someone is unwell',
];

/**
 * Everything the app knows about a trip while it's choosing what to offer.
 *
 * Deliberately the whole trip rather than just its type: the useful signals are CROSS-AXIS and
 * a per-type lookup can't see them. Flying has nothing to do with where you sleep and
 * everything to do with what you can pack.
 */
export type Axis = 'tripTypes' | 'travelModes' | 'lodgings';

export type TripContext = {
  tripTypes?: string[];
  travelModes?: string[];
  lodgings?: string[];
  departAt?: Date | string | null;
  returnAt?: Date | string | null;
};

type SeedRule = {
  /** Which tag list this touches. */
  kind: 'activities' | 'conditions';
  /**
   * Which axis the rule reads. Only `drop` needs it — see `applySeedRules`. Rules keyed on
   * something single-valued, like the departure date, leave it out.
   */
  axis?: Axis;
  when: (ctx: TripContext) => boolean;
  /** Promoted to the front — these are more predictive than the generic seeds. */
  add?: string[];
  /**
   * Demoted out of the seed row. NOT banned: every one of these stays in the pool and stays
   * one tap away behind the `+`. A rule that's slightly wrong should cost an extra tap, never
   * make something unreachable.
   */
  drop?: string[];
};

/** Does this axis hold the given value? Any of them matching is enough to fire an `add`. */
const has = (values: string[] | undefined, ...options: string[]) =>
  Boolean(values?.some((value) => options.some((o) => slugify(o) === slugify(value))));

/** Whole nights away, or undefined when the dates don't say. */
function nightsOf(ctx: TripContext): number | undefined {
  if (!ctx.departAt || !ctx.returnAt) return undefined;
  const from = new Date(ctx.departAt).getTime();
  const to = new Date(ctx.returnAt).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return undefined;
  return Math.round((to - from) / 86_400_000);
}

/**
 * Cross-axis seeding. Every rule is independent and any of them may fail to fire, which is
 * what makes the whole thing degrade quietly instead of breaking.
 */
const SEED_RULES: SeedRule[] = [
  // Flying is the sharpest constraint the app knows. Nothing with fuel in it gets on a plane,
  // and the gear-heavy activities stop being plausible.
  {
    kind: 'conditions',
    axis: 'travelModes',
    when: (ctx) => has(ctx.travelModes, 'Flying'),
    add: ['Long flight', 'Time zone change', 'Bag weight limit'],
    drop: ['No hookups', 'Fire ban', 'No water source'],
  },
  {
    kind: 'activities',
    axis: 'travelModes',
    when: (ctx) => has(ctx.travelModes, 'Flying'),
    drop: ['OHV', 'Real cooking', 'Hunting', 'Shooting'],
  },

  // Carrying everything on your back rules out anything heavy and rules in the backcountry.
  {
    kind: 'conditions',
    axis: 'lodgings',
    when: (ctx) => has(ctx.lodgings, 'Backpacking'),
    add: ['No water source', 'High altitude', 'Bear country'],
    drop: ['No hookups', 'Laundry available'],
  },
  {
    kind: 'activities',
    axis: 'lodgings',
    when: (ctx) => has(ctx.lodgings, 'Backpacking'),
    drop: ['Real cooking', 'OHV', 'Board games'],
  },

  // A roof, plumbing and a front desk retire most of the campsite worries.
  {
    kind: 'conditions',
    axis: 'lodgings',
    when: (ctx) => has(ctx.lodgings, 'Hotel', 'Rental', 'Hostel'),
    add: ['Laundry available'],
    drop: ['No hookups', 'Fire ban', 'Bear country', 'No water source', 'Cold nights'],
  },
  {
    kind: 'conditions',
    when: (ctx) => has(ctx.lodgings, 'Dispersed'),
    add: ['No water source', 'No hookups', 'No cell service'],
  },

  // Season comes from the departure date, so this fires the moment dates are picked.
  {
    kind: 'conditions',
    when: (ctx) => seasonOf(ctx.departAt) === 'winter',
    add: ['Cold nights', 'Snow', 'Short days'],
    drop: ['Buggy', 'Hot days', 'Sun exposure'],
  },
  {
    kind: 'conditions',
    when: (ctx) => seasonOf(ctx.departAt) === 'summer',
    add: ['Hot days', 'Sun exposure', 'Buggy'],
    drop: ['Snow', 'Cold nights', 'Short days'],
  },
  {
    kind: 'activities',
    when: (ctx) => seasonOf(ctx.departAt) === 'winter',
    add: ['Skiing', 'Snowboarding'],
    drop: ['Swimming', 'Paddling', 'Beach'],
  },
  {
    kind: 'activities',
    when: (ctx) => seasonOf(ctx.departAt) === 'summer',
    add: ['Swimming'],
    drop: ['Skiing', 'Snowboarding'],
  },

  // Long enough that clothes have to be washed or re-worn.
  {
    kind: 'conditions',
    when: (ctx) => (nightsOf(ctx) ?? 0) > 5,
    add: ['No laundry'],
  },
  {
    kind: 'conditions',
    when: (ctx) => has(ctx.travelModes, 'Driving') && (nightsOf(ctx) ?? 0) >= 1,
    add: ['Long drive'],
  },
];

/**
 * Applies the rules that fire for this trip, promoting their additions and demoting their
 * drops.
 *
 * Additions go FIRST because a rule fired on a real signal — flying, snow, a week away — is a
 * better predictor than a generic per-type list. Drops only leave the seed row; the pool still
 * holds them.
 *
 * ADDS UNION, DROPS NEED A UNANIMOUS AXIS. A trip has legs: drive out and fly back, a tent one
 * night and a spare room the next. Any value on an axis is enough to ADD — the flying leg
 * genuinely needs the bag weight limit. But a DROP has to be the only thing that axis says, or
 * one leg suppresses another's gear: flying-and-driving must not strip the stove, because the
 * driving leg still wants it. Multiple answers weaken a rule rather than compounding it.
 */
function applySeedRules(kind: 'activities' | 'conditions', base: string[], ctx: TripContext) {
  const byRule: string[][] = [];
  const dropped = new Set<string>();

  for (const rule of SEED_RULES) {
    if (rule.kind !== kind || !rule.when(ctx)) continue;
    if (rule.add?.length) byRule.push(rule.add);

    const unanimous = !rule.axis || (ctx[rule.axis] ?? []).length <= 1;
    if (unanimous) for (const tag of rule.drop ?? []) dropped.add(slugify(tag));
  }

  // Interleaved, like the per-type seeds. Concatenating let one rule's three additions eat the
  // whole six-chip budget and silently bury a later rule's — a trip that was both flying and a
  // three-day drive got told about the flight and nothing about the drive. Taking them in turn
  // means every rule that fired on a real signal is visible in what comes back.
  const added = interleave(byRule);

  // A tag another rule explicitly added outranks a drop — "Cold nights" in a winter hotel is
  // still worth offering even though hotels drop it.
  const promoted = new Set(added.map(slugify));
  return dedupeTags([...added, ...base]).filter(
    (tag) => promoted.has(slugify(tag)) || !dropped.has(slugify(tag)),
  );
}

/** Everything shipped for a kind of tag, for the browse list behind the `+`. */
function poolOf(byType: Record<string, string[]>, fallback: string[], more: string[]): string[] {
  return dedupeTags([...Object.values(byType).flat(), ...fallback, ...more]);
}

export const ACTIVITY_POOL = poolOf(ACTIVITIES_BY_TYPE, ACTIVITIES_FALLBACK, MORE_ACTIVITIES);
export const CONDITION_POOL = poolOf(CONDITIONS_BY_TYPE, CONDITIONS_FALLBACK, MORE_CONDITIONS);

/** Every axis, for the `+` sheet to browse. */
export const POOLS = {
  tripTypes: TRIP_TYPES,
  travelModes: TRAVEL,
  lodgings: LODGING,
  activities: ACTIVITY_POOL,
  conditions: CONDITION_POOL,
} as const;

export type TagKind = keyof typeof POOLS;

/**
 * Which chips to show without making the user open anything.
 *
 * Always includes what's already selected, so changing the trip type can never hide a tag the
 * user picked — it only changes what else is on offer.
 *
 * A shipped seed is rendered in the HOUSEHOLD'S spelling when they already have one. If they
 * write "FISHING", showing them "Fishing" and then storing "FISHING" underneath is a mismatch
 * they'd notice — the app's own spelling is a fallback, not an authority.
 *
 * @param ctx the trip so far — its type keys the seeds, and its travel, lodging and dates
 *            drive the cross-axis rules
 * @param selected tags already on the trip, in their stored spelling
 * @param used every spelling in play in this household, most-used first
 * @param history what this household tags trips LIKE THIS ONE with; see `tagsLikeThisTrip`
 * @returns the selected tags first, then unselected seeds
 */
export function suggestedTags(
  kind: TagKind,
  ctx: TripContext | string | undefined,
  selected: string[],
  used: string[] = [],
  history: string[] = [],
): string[] {
  const seeds = seedsFor(kind, ctx, history);
  const known = [...selected, ...used];
  const spelled = seeds.map((tag) => canonicalTag(tag, known) ?? tag);

  // Only what the seeds DON'T already offer gets pulled to the front. Prepending everything
  // selected would be simpler and worse: tapping a chip would yank it out from under the
  // finger that just hit it, and on a single-value axis — where every option is on screen
  // anyway — that reordering buys nothing. What it must never do is hide an answer, so a
  // selection the seeds don't cover ("Yurt", "Rockhounding") still leads.
  const seeded = new Set(spelled.map(slugify));
  const unseeded = selected.filter((tag) => !seeded.has(slugify(tag)));

  return dedupeTags([...unseeded, ...spelled, ...selected]);
}

/** How many seeds a row shows before the `+`. See DESIGN.md, The Six-Chip Rule. */
export const SEED_BUDGET = 6;

/**
 * The seeds for one axis.
 *
 * Three sources, in descending order of how much they know about THIS trip:
 *
 *  1. **The cross-axis rules**, which fire on a real signal about this trip — flying, snow, a
 *     week away. Applied last so their additions land at the front.
 *  2. **History**, what this household tags trips like this one with. Beats anything shipped:
 *     the app can guess that campers hike, but only history knows this family rockhounds.
 *  3. **The per-type list**, keyed on the type's SLUG so "Visiting people", "visiting people" and
 *     "VISITING PEOPLE" all find the same seeds. A type nobody wrote a list for falls back rather
 *     than coming back empty — that fallback is what lets the type axis be open at all.
 *
 * So a household with history mostly squeezes out the generic list, which is exactly the thing
 * worth squeezing. Nothing is lost either way: everything demoted is still one tap away in the
 * pool behind the `+`.
 *
 * Capped at `SEED_BUDGET`, fallbacks included — an unseeded type dumping the whole pool would
 * break the very rule the cap exists to enforce.
 */
export function seedsFor(
  kind: TagKind,
  ctx: TripContext | string | undefined,
  history: string[] = [],
): string[] {
  // A bare trip type is accepted for the axes that read nothing else.
  const context: TripContext = typeof ctx === 'string' ? { tripTypes: [ctx] } : (ctx ?? {});

  if (kind === 'tripTypes') return dedupeTags([...history, ...TRIP_TYPES]).slice(0, SEED_BUDGET);
  if (kind === 'travelModes') return dedupeTags([...history, ...TRAVEL]).slice(0, SEED_BUDGET);

  const byType =
    kind === 'lodgings'
      ? LODGING_BY_TYPE
      : kind === 'activities'
        ? ACTIVITIES_BY_TYPE
        : CONDITIONS_BY_TYPE;
  const fallback =
    kind === 'lodgings'
      ? LODGING_FALLBACK
      : kind === 'activities'
        ? ACTIVITIES_FALLBACK
        : CONDITIONS_FALLBACK;

  const base = dedupeTags([
    ...history,
    ...seedsForTypes(context.tripTypes ?? [], byType, fallback),
  ]);
  if (kind === 'lodgings') return base.slice(0, SEED_BUDGET);

  return applySeedRules(kind, base, context).slice(0, SEED_BUDGET);
}

/**
 * The per-type seeds for however many types a trip claims.
 *
 * INTERLEAVED, not concatenated. A camping-and-visiting trip that took the first six from
 * camping alone would be a trip type the user picked and the app ignored; taking them in turn
 * means every type they chose is visibly represented in the six they get.
 */
function seedsForTypes(
  types: string[],
  byType: Record<string, string[]>,
  fallback: string[],
): string[] {
  const lists = types.map((type) => byType[slugify(type)]).filter(Boolean);
  return lists.length ? interleave(lists) : fallback;
}

/** Round-robin, so a budget that cuts the tail cuts it evenly across every contributor. */
function interleave(lists: string[][]): string[] {
  if (lists.length <= 1) return lists[0] ?? [];

  const out: string[] = [];
  const longest = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) if (list[i]) out.push(list[i]);
  }
  return dedupeTags(out);
}

