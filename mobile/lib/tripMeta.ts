/**
 * How a trip describes itself, and the rules for reading that back.
 *
 * The point of all of it is MATCHING: a trip is the query that produces a packing list, so
 * every field here exists to be cross-referenced against past trips. A trip with only a name
 * can't be matched to anything.
 *
 * TWO KINDS OF VALUE LIVE HERE, and they follow opposite rules.
 *
 *   • CLOSED AXES (type, travel, lodging) are structural. They decide which suggestions load,
 *     code branches on them, and the user cannot invent new ones. They are stored as stable
 *     ids: change a `label` freely, treat an `id` as permanent.
 *
 *   • TAGS (activities, conditions) are arbitrary organising labels. The shipped lists are
 *     SUGGESTIONS, not a vocabulary of record — the user can add anything. They are stored as
 *     the label itself, because a slug round-trip mangles real text ("OHV" comes back "Ohv",
 *     and so do Airbnb, REI, and every place name). Slugs exist here only to COMPARE.
 *
 * Camping is the centre of gravity and has the deepest lists (see PRODUCT.md), but nothing in
 * this file assumes a tent.
 */

export type Vocab = { id: string; label: string };

/**
 * What kind of trip this is. The funnel key: it decides which lodging options, activities and
 * conditions get offered, so it belongs at the top of the form.
 *
 * Deliberately NOT a list of bundles like "backcountry hunting weekend". Those are
 * combinatorial, never finish being curated, and are already computable — the answer to "give
 * me a lot in one tap" is starting from a past trip, not a taxonomy someone has to maintain.
 */
export const TRIP_TYPES: Vocab[] = [
  { id: 'camping', label: 'Camping' },
  { id: 'vacation', label: 'Vacation' },
  { id: 'visiting', label: 'Visiting people' },
  { id: 'work', label: 'Work' },
  { id: 'event', label: 'Event' },
];

/**
 * How you get there. Its own axis because flying constrains a list harder than almost anything
 * else — liquids, bag weight, nothing with fuel in it, adapters — and none of that is implied
 * by where you're sleeping.
 */
export const TRAVEL: Vocab[] = [
  { id: 'car', label: 'Driving' },
  { id: 'plane', label: 'Flying' },
  { id: 'other', label: 'Train or boat' },
];

/**
 * Where you sleep. This is the old `setting` field widened past camping: it decides the sleep
 * system, the towels, the toiletries and whether there's a kitchen.
 */
export const LODGING: Vocab[] = [
  { id: 'tent', label: 'Tent' },
  // Kept as its own option rather than folded into `tent`: carrying everything on your back is
  // the sharpest packing constraint the app knows about. A backpacking list and a car-camping
  // list to the same place share almost nothing.
  { id: 'backpacking', label: 'Backpacking' },
  { id: 'dispersed', label: 'Dispersed' },
  { id: 'rv', label: 'RV or trailer' },
  { id: 'cabin', label: 'Cabin' },
  { id: 'rental', label: 'Rental' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'hosted', label: 'With family or friends' },
];

/** Lodging that makes sense for each kind of trip. Anything not listed stays behind the `+`. */
const LODGING_BY_TYPE: Record<string, string[]> = {
  camping: ['tent', 'backpacking', 'dispersed', 'rv', 'cabin'],
  vacation: ['hotel', 'rental', 'cabin', 'hosted'],
  visiting: ['hosted', 'hotel', 'rental'],
  work: ['hotel', 'rental'],
  event: ['hotel', 'rental', 'hosted'],
};

/**
 * Reads a trip's lodging, translating the deprecated camping-only `setting` field.
 *
 * `setting` was 'car' | 'backpacking' | 'rv' | 'cabin' | 'dispersed'. All but one survive as
 * lodging ids unchanged; 'car' meant car camping, which is a tent you didn't have to carry.
 *
 * Without the translation an old trip silently drops its lodging out of the summary, which is
 * data loss that looks like a rendering bug. Delete this once nothing stores a `setting`.
 */
export function lodgingOf(trip: { lodging?: string; setting?: string }): string | undefined {
  if (trip.lodging) return trip.lodging;
  return trip.setting === 'car' ? 'tent' : trip.setting;
}

/**
 * The activity chips shown by default, per trip type.
 *
 * Six-ish each, on purpose. Twenty-eight chips on one screen is a wall nobody reads, and the
 * long tail is one tap away behind the `+`. Once a household has history these give way to
 * what it actually tags on trips like this one.
 */
const ACTIVITIES_BY_TYPE: Record<string, string[]> = {
  camping: ['Hiking', 'Fishing', 'Paddling', 'Real cooking', 'Stargazing', 'Keeping kids busy'],
  vacation: ['Beach', 'Hiking', 'Swimming', 'Sightseeing', 'Eating out', 'Keeping kids busy'],
  visiting: ['Keeping kids busy', 'Eating out', 'Sightseeing', 'Helping out'],
  work: ['Presenting', 'Conference', 'Client dinner', 'Working out'],
  event: ['Ceremony', 'Reception', 'Photos', 'Working out'],
};

/** Shipped, but not a default anywhere. Browsable behind the `+`. */
const MORE_ACTIVITIES = [
  'Biking',
  'Climbing',
  'Hunting',
  'OHV',
  'Skiing',
  'Snowboarding',
  'Golf',
  'Running',
  'Photography',
  'Board games',
  'Reading',
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
  visiting: ['Cold nights', 'Hot days', 'Staying in a spare room', 'Pets in the house'],
  work: ['Formal dress', 'Long flight', 'Time zone change', 'Early mornings'],
  event: ['Formal dress', 'Hot days', 'Rain likely', 'Lots of walking'],
};

const MORE_CONDITIONS = [
  'Snow',
  'Wind',
  'High altitude',
  'No water source',
  'Fire ban',
  'Wildfire smoke',
  'Cold rain',
  'Laundry available',
  'No laundry',
  'Shared bathroom',
];

/** Everything shipped for a kind of tag, for the browse list behind the `+`. */
function poolOf(byType: Record<string, string[]>, more: string[]): string[] {
  return dedupeTags([...Object.values(byType).flat(), ...more]);
}

export const ACTIVITY_POOL = poolOf(ACTIVITIES_BY_TYPE, MORE_ACTIVITIES);
export const CONDITION_POOL = poolOf(CONDITIONS_BY_TYPE, MORE_CONDITIONS);

/**
 * Which chips to show without making the user open anything.
 *
 * Always includes what's already selected, so changing the trip type can never hide a tag the
 * user picked — it only changes what else is on offer. With no type chosen yet, camping leads,
 * because that's the product's centre of gravity and a wrong-but-close default beats an empty
 * screen.
 *
 * A shipped default is rendered in the HOUSEHOLD'S spelling when they already have one. If
 * they write "FISHING", showing them "Fishing" and then storing "FISHING" underneath is a
 * mismatch they'd notice — the app's own spelling is a fallback, not an authority.
 *
 * @param selected tags already on the trip, in their stored spelling
 * @param used every spelling in play in this household, most-used first
 * @returns the selected tags first, then unselected defaults for this type
 */
export function suggestedTags(
  kind: 'activities' | 'conditions',
  tripType: string | undefined,
  selected: string[],
  used: string[] = [],
): string[] {
  const byType = kind === 'activities' ? ACTIVITIES_BY_TYPE : CONDITIONS_BY_TYPE;
  const defaults = byType[tripType ?? ''] ?? byType.camping;
  const known = [...selected, ...used];

  return dedupeTags([...selected, ...defaults.map((tag) => canonicalTag(tag, known) ?? tag)]);
}

/** Lodging options for a trip type, plus whatever is already chosen. */
export function suggestedLodging(tripType: string | undefined, selected?: string): Vocab[] {
  const allowed = LODGING_BY_TYPE[tripType ?? ''] ?? LODGING.map((l) => l.id);
  const ids = new Set(selected ? [...allowed, selected] : allowed);
  return LODGING.filter((option) => ids.has(option.id));
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
 * already in use — a shipped suggestion, or whatever this household typed the first time.
 * First spelling wins and everything after converges on it, the same way the destination field
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
 * Unlike the vocabulary check this replaces, unrecognised values are KEPT — the whole point of
 * a user-extensible tag is that the app has never seen it before. Only non-strings are junk.
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

export function labelOf(id: string | undefined, vocab: Vocab[]): string | undefined {
  return vocab.find((v) => v.id === id)?.label;
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
 * Normalises a picked date to the calendar DAY the user meant.
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
    lodging,
    attendeeCount,
  }: {
    destination?: string;
    departAt?: Date | string | null;
    returnAt?: Date | string | null;
    lodging?: string;
    attendeeCount?: number;
  },
  today?: Date,
): string {
  return [
    destination,
    formatDateRange(departAt, returnAt, today),
    labelOf(lodging, LODGING),
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
  tripType?: string;
  travel?: string;
  lodging?: string;
  destination?: string;
  departAt?: Date | string | null;
  activities?: string[];
  conditions?: string[];
  attendeeCount?: number;
}): { filled: number; total: number } {
  const parts: [boolean, number][] = [
    [Boolean(trip.attendeeCount), 2],
    [Boolean(trip.tripType), 2],
    [Boolean(trip.lodging), 1],
    [Boolean(trip.travel), 1],
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
