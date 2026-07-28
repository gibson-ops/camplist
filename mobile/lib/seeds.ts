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
 * Camping is the centre of gravity and has the deepest seeds (see PRODUCT.md), but nothing in
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
  'Snorkelling',
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
  'Travelling with a baby',
  'Travelling with a dog',
  'Someone is unwell',
];

/**
 * Everything the app knows about a trip while it's choosing what to offer.
 *
 * Deliberately the whole trip rather than just its type: the useful signals are CROSS-AXIS and
 * a per-type lookup can't see them. Flying has nothing to do with where you sleep and
 * everything to do with what you can pack.
 */
export type TripContext = {
  tripType?: string;
  travel?: string;
  lodging?: string;
  departAt?: Date | string | null;
  returnAt?: Date | string | null;
};

type SeedRule = {
  /** Which tag list this touches. */
  kind: 'activities' | 'conditions';
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

const is = (value: string | undefined, ...options: string[]) =>
  Boolean(value && options.some((option) => slugify(option) === slugify(value)));

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
    when: (ctx) => is(ctx.travel, 'Flying'),
    add: ['Long flight', 'Time zone change', 'Bag weight limit'],
    drop: ['No hookups', 'Fire ban', 'No water source'],
  },
  {
    kind: 'activities',
    when: (ctx) => is(ctx.travel, 'Flying'),
    drop: ['OHV', 'Real cooking', 'Hunting', 'Shooting'],
  },

  // Carrying everything on your back rules out anything heavy and rules in the backcountry.
  {
    kind: 'conditions',
    when: (ctx) => is(ctx.lodging, 'Backpacking'),
    add: ['No water source', 'High altitude', 'Bear country'],
    drop: ['No hookups', 'Laundry available'],
  },
  {
    kind: 'activities',
    when: (ctx) => is(ctx.lodging, 'Backpacking'),
    drop: ['Real cooking', 'OHV', 'Board games'],
  },

  // A roof, plumbing and a front desk retire most of the campsite worries.
  {
    kind: 'conditions',
    when: (ctx) => is(ctx.lodging, 'Hotel', 'Rental', 'Hostel'),
    add: ['Laundry available'],
    drop: ['No hookups', 'Fire ban', 'Bear country', 'No water source', 'Cold nights'],
  },
  {
    kind: 'conditions',
    when: (ctx) => is(ctx.lodging, 'Dispersed'),
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
    when: (ctx) => is(ctx.travel, 'Driving') && (nightsOf(ctx) ?? 0) >= 1,
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
 */
function applySeedRules(kind: 'activities' | 'conditions', base: string[], ctx: TripContext) {
  const added: string[] = [];
  const dropped = new Set<string>();

  for (const rule of SEED_RULES) {
    if (rule.kind !== kind || !rule.when(ctx)) continue;
    added.push(...(rule.add ?? []));
    for (const tag of rule.drop ?? []) dropped.add(slugify(tag));
  }

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
  tripType: TRIP_TYPES,
  travel: TRAVEL,
  lodging: LODGING,
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
 * @returns the selected tags first, then unselected seeds
 */
export function suggestedTags(
  kind: TagKind,
  ctx: TripContext | string | undefined,
  selected: string[],
  used: string[] = [],
): string[] {
  const seeds = seedsFor(kind, ctx);
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
 * Starts from a per-type list keyed on the type's SLUG, so "Visiting people", "visiting people"
 * and "VISITING PEOPLE" all find the same seeds. A type nobody wrote a list for falls back
 * rather than coming back empty — that fallback is what lets the type axis be open at all.
 *
 * Then the cross-axis rules run, which is where most of the value is: flying, snow, and a week
 * away each say more about what to pack than the word "Vacation" does.
 *
 * Capped at `SEED_BUDGET`, fallbacks included — an unseeded type dumping the whole pool would
 * break the very rule the cap exists to enforce.
 */
export function seedsFor(kind: TagKind, ctx: TripContext | string | undefined): string[] {
  // A bare trip type is accepted for the axes that read nothing else.
  const context: TripContext = typeof ctx === 'string' ? { tripType: ctx } : (ctx ?? {});

  if (kind === 'tripType') return TRIP_TYPES.slice(0, SEED_BUDGET);
  if (kind === 'travel') return TRAVEL.slice(0, SEED_BUDGET);

  const key = slugify(context.tripType ?? '');
  if (kind === 'lodging') {
    return (LODGING_BY_TYPE[key] ?? LODGING_FALLBACK).slice(0, SEED_BUDGET);
  }

  const base =
    kind === 'activities'
      ? (ACTIVITIES_BY_TYPE[key] ?? ACTIVITIES_FALLBACK)
      : (CONDITIONS_BY_TYPE[key] ?? CONDITIONS_FALLBACK);

  return applySeedRules(kind, base, context).slice(0, SEED_BUDGET);
}

