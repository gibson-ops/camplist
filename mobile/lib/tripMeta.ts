/**
 * The controlled vocabularies a trip is described with, and the rules for reading them back.
 *
 * These exist so trips can be MATCHED against each other. Free text can't do that: "cold",
 * "cold nights" and "freezing" are one fact typed three ways, and for cross-referencing that
 * is the same as no fact at all. Trips still carry `notes` for everything a list of chips
 * can't say — notes just aren't asked to do matching.
 *
 * Adding a value here is cheap and safe. RENAMING one is not: ids are persisted on every trip
 * that ever selected them, so change `label` freely and treat `id` as permanent.
 */

export type Vocab = { id: string; label: string };

/**
 * How you're sleeping. Single-select, and the strongest single predictor of what belongs on a
 * list — a backpacking list and a car-camping list to the same place share almost nothing.
 */
export const SETTINGS: Vocab[] = [
  { id: 'car', label: 'Car camping' },
  { id: 'backpacking', label: 'Backpacking' },
  { id: 'dispersed', label: 'Dispersed' },
  { id: 'rv', label: 'RV or trailer' },
  { id: 'cabin', label: 'Cabin' },
];

/** What you plan to DO. Each one drags its own gear along behind it. */
export const ACTIVITIES: Vocab[] = [
  { id: 'hiking', label: 'Hiking' },
  { id: 'fishing', label: 'Fishing' },
  { id: 'paddling', label: 'Paddling' },
  { id: 'biking', label: 'Biking' },
  { id: 'climbing', label: 'Climbing' },
  { id: 'ohv', label: 'OHV' },
  { id: 'swimming', label: 'Swimming' },
  { id: 'hunting', label: 'Hunting' },
  { id: 'stargazing', label: 'Stargazing' },
  { id: 'cooking', label: 'Real cooking' },
  { id: 'photography', label: 'Photography' },
  { id: 'kids', label: 'Keeping kids busy' },
];

/**
 * What you're up against. Deliberately phrased as EXPECTATIONS ("rain likely") rather than
 * measurements: this is filled in while planning, and a forecast that far out is a guess
 * anyway. The post-trip reflection is where reality gets recorded.
 */
export const CONDITIONS: Vocab[] = [
  { id: 'cold-nights', label: 'Cold nights' },
  { id: 'hot-days', label: 'Hot days' },
  { id: 'rain', label: 'Rain likely' },
  { id: 'snow', label: 'Snow' },
  { id: 'wind', label: 'Wind' },
  { id: 'bugs', label: 'Buggy' },
  { id: 'altitude', label: 'High altitude' },
  { id: 'no-water', label: 'No water source' },
  { id: 'no-hookups', label: 'No hookups' },
  { id: 'fire-ban', label: 'Fire ban' },
  { id: 'bears', label: 'Bear country' },
];

/** A bare calendar date with no time part, e.g. "2026-03-01". */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads a stored departure date as the day the user meant.
 *
 * `new Date('2026-03-01')` is defined to parse as UTC midnight, which in any timezone west of
 * Greenwich is the PREVIOUS DAY locally — in Denver it's Feb 28, 17:00. Every month boundary
 * is also a season boundary somewhere, so a March 1 departure was classifying as winter and a
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
 * Normalises a picked date to the calendar DAY the user meant.
 *
 * Pinned to local NOON, not midnight. A trip date is a day, not an instant, and midnight is
 * the one moment of the day that can fail to exist — some timezones skip it entirely on a DST
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
 * Formatted by hand rather than through `toLocaleDateString` because this string is asserted
 * in tests and rendered on a row where width is scarce: the Intl output varies with the
 * device locale and runs longer than the space a NavRow gives it.
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
 * moved from August to October — and a trip whose season is wrong is worse for suggestions
 * than one with no season at all.
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

/** `i.json()` is unvalidated storage, so narrow it before anything downstream trusts it. */
export function parseVocab(raw: unknown, allowed: Vocab[]): string[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set(allowed.map((v) => v.id));
  return raw.filter((v): v is string => typeof v === 'string' && valid.has(v));
}

export function labelsFor(ids: string[], vocab: Vocab[]): string[] {
  const byId = new Map(vocab.map((v) => [v.id, v.label]));
  return ids.map((id) => byId.get(id)).filter((l): l is string => Boolean(l));
}

/**
 * The one-line summary under a trip name: where, when, how, how many.
 *
 * Ordered by how people actually identify a trip. Dates rather than season, even though season
 * is the thing suggestions match on: season is DERIVED from the departure date, so printing
 * both would say one fact twice, and of the two the dates are what tell you which trip this is.
 *
 * Empty parts drop out rather than leaving stray separators.
 */
export function tripSummary(
  {
    destination,
    departAt,
    returnAt,
    setting,
    attendeeCount,
  }: {
    destination?: string;
    departAt?: Date | string | null;
    returnAt?: Date | string | null;
    setting?: string;
    attendeeCount?: number;
  },
  today?: Date,
): string {
  return [
    destination,
    formatDateRange(departAt, returnAt, today),
    SETTINGS.find((s) => s.id === setting)?.label,
    attendeeCount ? `${attendeeCount} going` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * How completely a trip describes itself, as a fraction.
 *
 * Shown to the user as encouragement rather than as a score: every field they fill is another
 * axis suggestions can match on, and that trade is worth making explicit. Attendees and
 * setting are weighted double because they discriminate hardest between past trips.
 */
export function metadataCompleteness(trip: {
  destination?: string;
  departAt?: Date | string | null;
  setting?: string;
  activities?: string[];
  conditions?: string[];
  attendeeCount?: number;
}): { filled: number; total: number } {
  const parts: [boolean, number][] = [
    [Boolean(trip.attendeeCount), 2],
    [Boolean(trip.setting), 2],
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
