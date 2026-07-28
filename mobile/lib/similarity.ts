import { axesOf, parseTags, seasonOf, slugify, type Season } from './tripMeta';

/**
 * How alike two trips are.
 *
 * This is the other half of the suggestion engine. `itemSeeds.ts` answers "what does a trip like
 * this usually need" out of a table written by hand; this answers it out of what the household
 * actually packed, which is the only version that gets better. Seeds are the cold start, and
 * history should outrank them the moment it exists.
 *
 * The schema already calls a trip THE QUERY that produces a packing list — every optional field
 * on it exists to be cross-referenced against past trips. This module is that cross-reference.
 * Nothing here reads an item; it scores trip against trip and lets `itemHistory.ts` decide what
 * the winners imply.
 */

/** A trip reduced to the things worth matching on. */
export type TripShape = {
  id: string;
  name: string;
  tripTypes: string[];
  travelModes: string[];
  lodgings: string[];
  activities: string[];
  conditions: string[];
  destination?: string;
  season?: Season;
  attendeeIds: string[];
  /** Departure if it has one, creation date otherwise. Only ever used for recency. */
  when: number;
  /** Whether the trip actually happened. See `wasTaken`. */
  taken: boolean;
};

/**
 * How much each axis predicts what ends up in the bag.
 *
 * Not how much it describes the trip — how much it changes the LIST. Lodging is the heaviest
 * because a tent and a hotel room share almost nothing, and trip type ties it because it's the
 * frame every other answer hangs on.
 *
 * ATTENDEES ARE WEIGHTED LOW, against the schema's claim that they're the cleanest signal
 * available. That claim ignores base rates: in a household of three, near enough every trip has
 * the same three people on it, so the axis agrees with everything and discriminates between
 * nothing. It earns its weight on the rare trip where someone stays home — which is exactly when
 * a low weight still lets it break a tie.
 *
 * Destination is low for the opposite reason: going back to the same lake is a strong hint, but
 * the axes underneath it already say why (same lodging, same activities, same conditions), so
 * weighting it heavily would count one fact twice.
 */
const WEIGHT = {
  tripTypes: 3,
  lodgings: 3,
  travelModes: 2,
  activities: 2,
  conditions: 2,
  attendees: 1,
  destination: 1,
  season: 1,
} as const;

/**
 * Below this, nothing in the household's history is like this trip.
 *
 * The number matters because similarity is RELATIVE: something is always the best match, and
 * without a floor a first-ever flying trip would be "matched" against five years of driving to
 * the same campground and suggested a camp stove for the overhead bin. The floor is what lets a
 * genuinely novel trip fall through to the seeds, which is the case seeds are actually for.
 *
 * Calibrated against the worst realistic false positive: a trip that shares only its people and
 * its season with everything else scores (1 + 1) / 15 ≈ 0.13, so it has to clear real overlap on
 * an axis that predicts gear.
 */
export const MATCH_FLOOR = 0.25;

/**
 * What a trip that hasn't happened yet is worth as evidence.
 *
 * Halved rather than dropped, because a list you curated is evidence of intent even before it's
 * evidence of outcome. Halved rather than kept, because of a feedback loop that would otherwise
 * close on itself: the app suggests something, you accept it, the trip never happens, and the
 * accepted suggestion comes back as "history" and gets suggested harder. Nothing in that chain
 * involved anybody packing anything.
 */
const PLANNED_WEIGHT = 0.5;

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * How much a trip's age discounts it, and why it barely does.
 *
 * The obvious move is to decay old trips hard. It's wrong here: the single most useful trip in
 * the history of a packing app is the same trip last year. An annual trip is the strongest signal
 * this product will ever see, and an aggressive decay is precisely the rule that would throw it
 * away. So age costs at most 30%, on a two-year half-life.
 *
 * Recency also deliberately does NOT feed `similarity` — a three-year-old identical trip is still
 * the best guide available, and letting age push it under `MATCH_FLOOR` would be the app
 * forgetting something it knows. Age weights the VOTE, not the relevance.
 */
const RECENCY_FLOOR = 0.7;
const HALF_LIFE_YEARS = 2;

export function recencyWeight(when: number, now: number): number {
  const years = (now - when) / MS_PER_YEAR;
  if (!Number.isFinite(years) || years <= 0) return 1;
  return RECENCY_FLOOR + (1 - RECENCY_FLOOR) * Math.pow(2, -years / HALF_LIFE_YEARS);
}

/** The rows `shapeOf` can read. Everything past the id is optional, as it is in the schema. */
export type TripRow = {
  id: string;
  name?: string;
  destination?: string;
  /** Whatever the store hands back — Instant dates arrive as epoch numbers as readily as Dates. */
  departAt?: Date | string | number | null;
  createdAt?: Date | string | number | null;
  status?: string;
  tripTypes?: unknown;
  travelModes?: unknown;
  lodgings?: unknown;
  activities?: unknown;
  conditions?: unknown;
  tripType?: string;
  travel?: string;
  lodging?: string;
  setting?: string;
  attendees?: { id: string }[];
  lists?: { items?: { state?: string }[] }[];
};

function time(value: Date | string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const ms = +new Date(value);
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * Whether a trip HAPPENED, which is the difference between evidence and intent.
 *
 * Three ways to know, and the third is the one that matters. A departure date in the past and an
 * archived status are both the app's own bookkeeping, and plenty of real trips have neither —
 * dates are optional and nobody archives anything. But a packed item is the user's own testimony
 * that they stood in front of a pile of gear with this list open. That can't be faked by the
 * suggestion engine, which is what makes it the honest signal.
 */
export function wasTaken(trip: TripRow, now: number): boolean {
  const departed = time(trip.departAt);
  if (departed !== undefined && departed < now) return true;
  if (trip.status === 'archived') return true;
  return (trip.lists ?? []).some((list) =>
    (list.items ?? []).some((item) => item.state && item.state !== 'unpacked'),
  );
}

/** Reads a stored trip row as the thing the matcher compares. */
export function shapeOf(trip: TripRow, now: number = Date.now()): TripShape {
  const axes = axesOf(trip);

  return {
    id: trip.id,
    name: trip.name ?? '',
    tripTypes: axes.tripTypes,
    travelModes: axes.travelModes,
    lodgings: axes.lodgings,
    activities: parseTags(trip.activities),
    conditions: parseTags(trip.conditions),
    destination: trip.destination?.trim() || undefined,
    season: seasonOf(trip.departAt),
    attendeeIds: (trip.attendees ?? []).map((p) => p.id),
    when: time(trip.departAt) ?? time(trip.createdAt) ?? now,
    taken: wasTaken(trip, now),
  };
}

/**
 * Overlap between two sets of tags, 0 to 1.
 *
 * Jaccard (shared / combined) rather than coverage (shared / mine), and the difference decides
 * what wins. Under coverage, a past trip tagged with everything covers every future trip
 * perfectly and outranks a focused match — the over-described trip becomes the answer to every
 * question, and its whole sprawling list gets suggested. Jaccard charges a trip for the things it
 * did that this one isn't doing, so "we went camping" beats "we went camping and to a wedding"
 * when all you're doing is camping. That's the right answer.
 */
function overlap(a: string[], b: string[]): number {
  const mine = new Set(a.map(slugify));
  const theirs = new Set(b.map(slugify));
  if (!mine.size && !theirs.size) return 0;

  let shared = 0;
  for (const key of mine) if (theirs.has(key)) shared += 1;
  return shared / (mine.size + theirs.size - shared);
}

/**
 * How well a past trip matches the one being packed, 0 to 1.
 *
 * ASYMMETRIC BY DESIGN, and only in one way: an axis the CURRENT trip says nothing about is
 * dropped from the score entirely rather than counted as a miss. A half-described trip should get
 * worse matches, not uniformly bad ones — if you haven't said what the weather will be, the
 * weather can't discriminate, and scoring it zero would drag every candidate toward the floor and
 * leave the household with no history at all. Silence is not disagreement.
 *
 * The reverse isn't true: if this trip names a lodging and the past one doesn't, that's a real
 * miss and scores zero. A trip that never said where it slept can't be evidence about tents.
 */
export function similarity(current: TripShape, past: TripShape): number {
  let scored = 0;
  let possible = 0;

  const axis = (weight: number, mine: string[], theirs: string[]) => {
    if (!mine.length) return;
    possible += weight;
    scored += weight * overlap(mine, theirs);
  };

  axis(WEIGHT.tripTypes, current.tripTypes, past.tripTypes);
  axis(WEIGHT.lodgings, current.lodgings, past.lodgings);
  axis(WEIGHT.travelModes, current.travelModes, past.travelModes);
  axis(WEIGHT.activities, current.activities, past.activities);
  axis(WEIGHT.conditions, current.conditions, past.conditions);
  axis(WEIGHT.attendees, current.attendeeIds, past.attendeeIds);
  axis(
    WEIGHT.destination,
    current.destination ? [current.destination] : [],
    past.destination ? [past.destination] : [],
  );
  axis(WEIGHT.season, current.season ? [current.season] : [], past.season ? [past.season] : []);

  return possible ? scored / possible : 0;
}

export type ScoredTrip = {
  shape: TripShape;
  /** How alike the two trips are, before age or outcome are considered. */
  score: number;
  /** What its vote is worth: `score`, aged, and discounted if it never happened. */
  weight: number;
};

/**
 * Past trips worth learning from, best match first.
 *
 * Drops the current trip (a trip is a perfect match for itself and would suggest its own contents
 * straight back) and anything under `MATCH_FLOOR`.
 *
 * @param past every other trip in the household; unmatched ones are filtered out here, not by
 *             the caller, so there is one definition of "like this trip"
 * @param now injectable so the tests aren't calendar-dependent
 */
export function rankTrips(
  current: TripShape,
  past: TripRow[],
  now: number = Date.now(),
): ScoredTrip[] {
  return past
    .filter((row) => row.id !== current.id)
    .map((row) => {
      const shape = shapeOf(row, now);
      const score = similarity(current, shape);
      return {
        shape,
        score,
        weight: score * recencyWeight(shape.when, now) * (shape.taken ? 1 : PLANNED_WEIGHT),
      };
    })
    .filter((scored) => scored.score >= MATCH_FLOOR)
    .sort((a, b) => b.weight - a.weight || b.shape.when - a.shape.when);
}
