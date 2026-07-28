/**
 * Reading a trip back: its tags, its dates, and how it describes itself in one line.
 *
 * The point of all of it is MATCHING: a trip is the query that produces a packing list, so
 * every field here exists to be cross-referenced against past trips. A trip with only a name
 * can't be matched to anything.
 *
 * EVERY AXIS IS A TAG. Type, travel, lodging, activities, conditions — the only difference
 * between them is that the first three take one value and the last two take several. They all
 * store the LABEL the user sees, they all canonicalize the same way, and the user can add to
 * any of them.
 *
 * Labels rather than slugs, because a slug round-trip mangles real text — "OHV" comes back
 * "Ohv", and so do Airbnb, REI, and every place name. Slugs exist here only to COMPARE.
 *
 * What the app OFFERS lives in lib/seeds.ts. This module is what it means.
 */

/**
 * Ids written while type, travel and lodging were briefly closed sets, plus the camping-only
 * `setting` field that preceded lodging.
 *
 * Every axis stores a label now, so a stored id renders literally: a trip whose lodging reads
 * "rv" or whose type reads "visiting" looks like corruption. `setting` had one value with no
 * direct heir — 'car' meant car camping, which is a tent you didn't have to carry.
 *
 * Delete once nothing stores an id.
 */
const LEGACY_AXIS_LABELS: Record<string, string> = {
  // `setting`, then lodging ids
  car: 'Tent',
  tent: 'Tent',
  backpacking: 'Backpacking',
  dispersed: 'Dispersed',
  rv: 'RV or trailer',
  cabin: 'Cabin',
  rental: 'Rental',
  hotel: 'Hotel',
  hosted: 'With family or friends',
  // travel ids
  plane: 'Flying',
  other: 'Train',
  // trip type ids
  camping: 'Camping',
  vacation: 'Vacation',
  visiting: 'Visiting people',
  work: 'Work',
  event: 'Event',
};

/**
 * Reads one axis as the list it is now, collapsing every earlier generation of the field.
 *
 * Three shapes have to arrive at the same place: the current `i.json()` array, the
 * single-value string that preceded it, and the camping-only id before that. Whichever is
 * present wins in that order, ids get translated to labels, and the result is always a list.
 *
 * @param current the plural field, unvalidated as it comes out of `i.json()`
 * @param legacy older single-value fields, most recent first
 */
export function axisValues(current: unknown, ...legacy: (string | undefined)[]): string[] {
  const fromCurrent = parseTags(current);
  if (fromCurrent.length) return fromCurrent.map((v) => LEGACY_AXIS_LABELS[v] ?? v);

  const stored = legacy.find(Boolean);
  return stored ? [LEGACY_AXIS_LABELS[stored] ?? stored] : [];
}

/** The three axes of a trip, however old the trip is. */
export function axesOf(trip: {
  tripTypes?: unknown;
  travelModes?: unknown;
  lodgings?: unknown;
  tripType?: string;
  travel?: string;
  lodging?: string;
  setting?: string;
}) {
  return {
    tripTypes: axisValues(trip.tripTypes, trip.tripType),
    travelModes: axisValues(trip.travelModes, trip.travel),
    // 'car' only ever meant car camping, and only ever in `setting`.
    lodgings: axisValues(trip.lodgings, trip.lodging, trip.setting),
  };
}

/**
 * Comparison key for a tag. NEVER stored — only used to decide whether two spellings are the
 * same tag.
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Drops blanks and keeps the first spelling of anything that repeats. */
export function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const key = slugify(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(tag.trim());
  }
  return out;
}

/**
 * Settles on ONE spelling for a tag before it's stored.
 *
 * Dedupe alone isn't enough: it would happily keep "cold nights" on one trip and "Cold nights"
 * on another, which match fine and read as sloppy. So a newly typed tag adopts the spelling
 * already in use — a shipped seed, or whatever this household typed the first time. First
 * spelling wins and everything after converges on it, the same way the destination field
 * converges on one spelling of "the Uintas".
 *
 * @param known spellings already in play, most authoritative first
 * @returns the canonical spelling, or undefined when there's nothing but whitespace
 */
export function canonicalTag(value: string, known: string[]): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const key = slugify(trimmed);
  if (!key) return undefined;

  return known.find((candidate) => slugify(candidate) === key) ?? trimmed;
}

/**
 * Tags written when activities and conditions were closed vocabularies stored as IDS.
 *
 * Most survive a slug round-trip on their own ('fishing' → 'Fishing'), but these don't, and
 * translating the whole set is cheaper than reasoning about which. Left out and they surface
 * as literal tags: a trip showing "cold-nights" and "no-water" reads as corruption.
 *
 * Worse, `canonicalTag` would then treat the id as the household's preferred spelling and
 * every future trip would converge on it — a legacy id is not a spelling anyone chose.
 *
 * Delete once no trip stores one.
 */
const LEGACY_TAG_LABELS: Record<string, string> = {
  // Activities
  hiking: 'Hiking',
  fishing: 'Fishing',
  paddling: 'Paddling',
  biking: 'Biking',
  climbing: 'Climbing',
  ohv: 'OHV',
  swimming: 'Swimming',
  hunting: 'Hunting',
  stargazing: 'Stargazing',
  photography: 'Photography',
  cooking: 'Real cooking',
  kids: 'Keeping kids busy',
  // Conditions
  snow: 'Snow',
  wind: 'Wind',
  bugs: 'Buggy',
  rain: 'Rain likely',
  bears: 'Bear country',
  altitude: 'High altitude',
  'no-water': 'No water source',
  'cold-nights': 'Cold nights',
  'hot-days': 'Hot days',
  'no-hookups': 'No hookups',
  'fire-ban': 'Fire ban',
};

/**
 * `i.json()` is unvalidated storage, so narrow it before anything downstream trusts it.
 *
 * Unrecognized values are KEPT — the whole point of a user-extensible tag is that the app has
 * never seen it before. Only non-strings are junk.
 *
 * The single choke point for reading tags, which is why the legacy translation lives here
 * rather than at each call site: no caller can forget it.
 */
export function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const strings = raw.filter((v): v is string => typeof v === 'string');
  return dedupeTags(strings.map((tag) => LEGACY_TAG_LABELS[tag] ?? tag));
}

/** Adds or removes one tag, keeping the stored spelling canonical and the order stable. */
export function toggleTag(tags: string[], tag: string, known: string[] = []): string[] {
  const canonical = canonicalTag(tag, [...tags, ...known]);
  if (!canonical) return tags;

  const key = slugify(canonical);
  return tags.some((t) => slugify(t) === key)
    ? tags.filter((t) => slugify(t) !== key)
    : [...tags, canonical];
}

/** A bare calendar date with no time part, e.g. "2026-03-01". */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads a stored date as the day the user meant.
 *
 * `new Date('2026-03-01')` is defined to parse as UTC midnight, which in any timezone west of
 * Greenwich is the PREVIOUS DAY locally — in Denver it's Feb 28, 17:00. Every month boundary is
 * also a season boundary somewhere, so a March 1 departure was classifying as winter and a
 * September 1 trip as summer: the packing list would be matched against the wrong half of the
 * year, which is the one thing season exists to prevent.
 *
 * A date-only string therefore gets built from its parts at LOCAL midnight. A real Date is
 * already an instant and is used as-is.
 */
function toLocalDate(value: Date | string): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;

  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Normalizes a picked date to the calendar DAY the user meant.
 *
 * Pinned to local NOON, not midnight. A trip date is a day, not an instant, and midnight is the
 * one moment of the day that can fail to exist — some timezones skip it entirely on a DST
 * transition, and anywhere west of UTC it's the previous day once serialized. Noon is twelve
 * hours clear of both edges in every timezone on earth.
 *
 * @param value whatever the picker handed back, at whatever time of day
 * @returns the same calendar day at 12:00 local
 */
export function toCalendarDate(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * A trip's dates as one short fragment: "Sep 4–7", "Sep 28 – Oct 2", "Sep 4, 2027".
 *
 * Formatted by hand rather than through `toLocaleDateString` because this string is asserted in
 * tests and rendered on a row where width is scarce: the Intl output varies with the device
 * locale and runs longer than the space a NavRow gives it.
 *
 * A `returnAt` with no `departAt` produces nothing. Half a range is not a date.
 *
 * @param today reference point for deciding whether the year is worth printing; injectable so
 *              the tests aren't calendar-dependent
 */
export function formatDateRange(
  departAt?: Date | string | null,
  returnAt?: Date | string | null,
  today: Date = new Date(),
): string | undefined {
  const from = departAt ? toLocalDate(departAt) : undefined;
  if (!from) return undefined;
  const to = returnAt ? toLocalDate(returnAt) : undefined;

  const day = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  // The year is noise eleven months of the year and essential the twelfth. Print it only when
  // the trip isn't in the year we're standing in.
  const year = from.getFullYear() !== today.getFullYear() ? `, ${from.getFullYear()}` : '';

  if (!to || +to <= +from) return `${day(from)}${year}`;
  if (to.getMonth() === from.getMonth() && to.getFullYear() === from.getFullYear()) {
    return `${day(from)}–${to.getDate()}${year}`;
  }
  return `${day(from)} – ${day(to)}${year}`;
}

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export const SEASON_LABEL: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
};

/**
 * Time of year, DERIVED from the departure date rather than stored.
 *
 * Storing it would mean two sources of truth that silently disagree the moment a trip gets
 * moved from August to October — and a trip whose season is wrong is worse for suggestions than
 * one with no season at all.
 *
 * Northern hemisphere. A dateless trip simply has no season signal, which is honest: if the
 * user hasn't picked dates, the app genuinely doesn't know.
 *
 * @param departAt when they leave home
 * @returns the meteorological season, or undefined when there's no date to derive from
 */
export function seasonOf(departAt?: Date | string | null): Season | undefined {
  if (!departAt) return undefined;
  const d = toLocalDate(departAt);
  if (!d) return undefined;

  const m = d.getMonth(); // 0-indexed
  if (m <= 1 || m === 11) return 'winter'; // Dec, Jan, Feb
  if (m <= 4) return 'spring'; // Mar, Apr, May
  if (m <= 7) return 'summer'; // Jun, Jul, Aug
  return 'fall'; // Sep, Oct, Nov
}

/**
 * The one-line summary under a trip name: where, when, how, how many.
 *
 * Ordered by how people actually identify a trip. Dates rather than season, even though season
 * is what suggestions match on: season is derived FROM the departure date, so printing both
 * would state one fact twice, and of the two the dates tell you which trip this is.
 *
 * Lodging rather than trip type, because the type is usually obvious from the name ("Uintas,
 * Labor Day") while where you're sleeping is not.
 *
 * Empty parts drop out rather than leaving stray separators.
 */
export function tripSummary(
  {
    destination,
    departAt,
    returnAt,
    lodgings,
    attendeeCount,
  }: {
    destination?: string;
    departAt?: Date | string | null;
    returnAt?: Date | string | null;
    lodgings?: string[];
    attendeeCount?: number;
  },
  today?: Date,
): string {
  return [
    destination,
    formatDateRange(departAt, returnAt, today),
    // A trip with legs sleeps in more than one place; the summary says so rather than picking.
    lodgings?.length ? lodgings.join(' + ') : undefined,
    attendeeCount ? `${attendeeCount} going` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * How completely a trip describes itself, as a fraction.
 *
 * Shown to the user as encouragement rather than as a score: every field they fill is another
 * axis suggestions can match on, and that trade is worth making explicit.
 *
 * Attendees and trip type are weighted double. Type decides which suggestions load at all, and
 * who is going discriminates hardest between past trips.
 */
export function metadataCompleteness(trip: {
  tripTypes?: string[];
  travelModes?: string[];
  lodgings?: string[];
  destination?: string;
  departAt?: Date | string | null;
  activities?: string[];
  conditions?: string[];
  attendeeCount?: number;
}): { filled: number; total: number } {
  const parts: [boolean, number][] = [
    [Boolean(trip.attendeeCount), 2],
    [Boolean(trip.tripTypes?.length), 2],
    [Boolean(trip.lodgings?.length), 1],
    [Boolean(trip.travelModes?.length), 1],
    [Boolean(trip.destination), 1],
    [Boolean(trip.departAt), 1],
    [Boolean(trip.activities?.length), 1],
    [Boolean(trip.conditions?.length), 1],
  ];
  return {
    filled: parts.reduce((n, [ok, w]) => n + (ok ? w : 0), 0),
    total: parts.reduce((n, [, w]) => n + w, 0),
  };
}
