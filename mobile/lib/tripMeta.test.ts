import {
  axesOf,
  axisValues,
  canonicalTag,
  dedupeTags,
  formatDateRange,
  metadataCompleteness,
  parseTags,
  seasonOf,
  slugify,
  toCalendarDate,
  toggleTag,
  tripSummary,
} from './tripMeta';
import { ACTIVITY_POOL, CONDITION_POOL, LODGING, TRAVEL, TRIP_TYPES } from './seeds';

describe('seasonOf', () => {
  it('maps months to meteorological seasons', () => {
    expect(seasonOf(new Date('2026-01-15'))).toBe('winter');
    expect(seasonOf(new Date('2026-04-15'))).toBe('spring');
    expect(seasonOf(new Date('2026-07-15'))).toBe('summer');
    expect(seasonOf(new Date('2026-10-15'))).toBe('fall');
  });

  it('wraps December back into winter', () => {
    expect(seasonOf(new Date('2026-12-20'))).toBe('winter');
    expect(seasonOf(new Date('2026-02-28'))).toBe('winter');
  });

  /**
   * Every month boundary is a season boundary somewhere, and a date-only string parses as UTC
   * midnight — which in Denver is 17:00 the PREVIOUS day. Before this was fixed, a March 1
   * departure classified as winter and a September 1 trip as summer, matching the packing
   * list against the wrong half of the year.
   */
  it('puts a date-only boundary in the right season locally, not in UTC', () => {
    expect(seasonOf('2026-02-28')).toBe('winter');
    expect(seasonOf('2026-03-01')).toBe('spring');
    expect(seasonOf('2026-05-31')).toBe('spring');
    expect(seasonOf('2026-06-01')).toBe('summer');
    expect(seasonOf('2026-08-31')).toBe('summer');
    expect(seasonOf('2026-09-01')).toBe('fall');
    expect(seasonOf('2026-11-30')).toBe('fall');
    expect(seasonOf('2026-12-01')).toBe('winter');
  });

  it('treats a real Date as the instant it already is', () => {
    // Local-midnight constructor: no timezone reinterpretation to do.
    expect(seasonOf(new Date(2026, 2, 1))).toBe('spring');
    expect(seasonOf(new Date(2026, 8, 1))).toBe('fall');
  });

  // A dateless trip genuinely has no season, and saying so beats guessing one. Suggestions
  // matching on a wrong season would be worse than matching on one axis fewer.
  it('returns undefined rather than guessing', () => {
    expect(seasonOf(undefined)).toBeUndefined();
    expect(seasonOf(null)).toBeUndefined();
    expect(seasonOf('not a date')).toBeUndefined();
  });

  it('accepts a stored ISO string as well as a Date', () => {
    expect(seasonOf('2026-07-15T09:00:00.000Z')).toBe('summer');
  });
});

describe('axisValues', () => {
  /**
   * Three generations have to arrive at the same place: the current list, the single-value
   * string that preceded it, and the camping-only id before that. An untranslated id renders
   * literally — a trip whose lodging reads "rv" looks like corruption — and `canonicalTag`
   * would adopt it as the household's preferred spelling.
   */
  it('reads the current list', () => {
    expect(axisValues(['Camping', 'Visiting people'])).toEqual(['Camping', 'Visiting people']);
  });

  it('falls back to the single-value field when the list is empty', () => {
    expect(axisValues(undefined, 'Hotel')).toEqual(['Hotel']);
    expect(axisValues([], 'Hotel')).toEqual(['Hotel']);
  });

  it('translates ids left over from the closed-set era', () => {
    expect(axisValues(undefined, 'rv')).toEqual(['RV or trailer']);
    expect(axisValues(undefined, 'visiting')).toEqual(['Visiting people']);
    expect(axisValues(['plane'])).toEqual(['Flying']);
  });

  it('takes the first legacy field that has anything', () => {
    expect(axisValues(undefined, '', 'car')).toEqual(['Tent']);
    expect(axisValues(undefined, 'Hotel', 'car')).toEqual(['Hotel']);
  });

  it('is empty when nothing was ever answered', () => {
    expect(axisValues(undefined)).toEqual([]);
    expect(axisValues(undefined, undefined, undefined)).toEqual([]);
  });

  it('survives junk in the column', () => {
    expect(axisValues(['Tent', 42, null])).toEqual(['Tent']);
    expect(axisValues('Tent')).toEqual([]);
  });
});

describe('axesOf', () => {
  it('collapses every generation of every axis', () => {
    expect(axesOf({ setting: 'car' }).lodgings).toEqual(['Tent']);
    expect(axesOf({ lodgings: ['hotel'] }).lodgings).toEqual(['Hotel']);
    expect(axesOf({ lodgings: ['Tent', 'Hotel'] }).lodgings).toEqual(['Tent', 'Hotel']);
  });

  it('prefers the newest generation that has anything', () => {
    expect(axesOf({ lodgings: ['Yurt'], lodging: 'hotel', setting: 'car' }).lodgings).toEqual([
      'Yurt',
    ]);
  });

  // Backpacking is the sharpest packing constraint the app knows; it survived both widenings.
  it('keeps backpacking as its own thing', () => {
    expect(axesOf({ setting: 'backpacking' }).lodgings).toEqual(['Backpacking']);
    expect(LODGING).toContain('Backpacking');
  });

  it('has nothing to say about a trip with none of them', () => {
    expect(axesOf({})).toEqual({ tripTypes: [], travelModes: [], lodgings: [] });
  });
});

describe('slugify', () => {
  // The comparison key, never stored. Storing it would mangle real text on the way back out.
  it('collapses spelling differences that mean the same tag', () => {
    expect(slugify('Cold nights')).toBe(slugify('cold nights'));
    expect(slugify('  Cold  Nights  ')).toBe('cold-nights');
    expect(slugify('OHV')).toBe('ohv');
  });

  it('is empty for something with no substance', () => {
    expect(slugify('   ')).toBe('');
    expect(slugify('!!!')).toBe('');
  });
});

describe('canonicalTag', () => {
  /**
   * THE RULE THAT KEEPS FREE TEXT FROM WRECKING MATCHING.
   *
   * Deduping alone would let "cold nights" sit on one trip and "Cold nights" on another: they
   * compare equal but read as sloppy. A new tag adopts the spelling already in play instead.
   */
  it('adopts the spelling already in use', () => {
    expect(canonicalTag('cold nights', ['Cold nights'])).toBe('Cold nights');
    expect(canonicalTag('  HIKING ', ['Hiking'])).toBe('Hiking');
  });

  it('keeps what the user typed when nothing matches', () => {
    expect(canonicalTag('Rockhounding', ['Hiking'])).toBe('Rockhounding');
  });

  // Storing the label rather than a slug is the whole reason real text survives.
  it('preserves capitalisation a slug round-trip would destroy', () => {
    expect(canonicalTag('OHV', [])).toBe('OHV');
    expect(canonicalTag('Airbnb', [])).toBe('Airbnb');
  });

  it('rejects whitespace and punctuation-only input', () => {
    expect(canonicalTag('   ', ['Hiking'])).toBeUndefined();
    expect(canonicalTag('!!!', [])).toBeUndefined();
  });

  it('prefers the first of several known spellings', () => {
    expect(canonicalTag('cold nights', ['Cold Nights', 'Cold nights'])).toBe('Cold Nights');
  });
});

describe('dedupeTags', () => {
  it('keeps the first spelling of anything repeated', () => {
    expect(dedupeTags(['Cold nights', 'cold nights', 'Hiking'])).toEqual(['Cold nights', 'Hiking']);
  });

  it('drops blanks and trims', () => {
    expect(dedupeTags(['  Hiking  ', '', '   '])).toEqual(['Hiking']);
  });
});

describe('parseTags', () => {
  /**
   * The opposite of the old vocabulary guard, on purpose: an unrecognized tag is the POINT of
   * a user-extensible set, so it's kept rather than dropped. Only non-strings are junk.
   */
  it('keeps tags the app has never heard of', () => {
    expect(parseTags(['Hiking', 'Rockhounding'])).toEqual(['Hiking', 'Rockhounding']);
  });

  /**
   * Trips written when activities were a closed vocabulary stored IDS. Left untranslated they
   * surface as literal tags — "cold-nights" on screen reads as corruption — and worse,
   * `canonicalTag` would adopt the id as the household's preferred spelling and every future
   * trip would converge on it.
   */
  it('translates ids left over from the closed-vocabulary era', () => {
    expect(parseTags(['fishing', 'cold-nights', 'no-water'])).toEqual([
      'Fishing',
      'Cold nights',
      'No water source',
    ]);
  });

  it('translates ids whose label was never just their capitalisation', () => {
    expect(parseTags(['cooking', 'kids', 'bugs', 'ohv'])).toEqual([
      'Real cooking',
      'Keeping kids busy',
      'Buggy',
      'OHV',
    ]);
  });

  // Every translation has to land on something the pools actually contain, or the tag arrives
  // as an orphan the `+` sheet can't show.
  it('translates only into tags the app ships', () => {
    const known = new Set([...ACTIVITY_POOL, ...CONDITION_POOL].map(slugify));
    for (const legacy of ['fishing', 'cooking', 'kids', 'bugs', 'no-water', 'fire-ban']) {
      expect(known.has(slugify(parseTags([legacy])[0]))).toBe(true);
    }
  });

  it('leaves a translated tag alone the second time through', () => {
    expect(parseTags(parseTags(['cooking']))).toEqual(['Real cooking']);
  });

  it('drops non-strings and survives junk in the column', () => {
    expect(parseTags(['Hiking', 42, null])).toEqual(['Hiking']);
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags('Hiking')).toEqual([]);
    expect(parseTags({ hiking: true })).toEqual([]);
  });
});

describe('toggleTag', () => {
  it('adds a tag and removes it again', () => {
    expect(toggleTag(['Hiking'], 'Fishing')).toEqual(['Hiking', 'Fishing']);
    expect(toggleTag(['Hiking', 'Fishing'], 'Hiking')).toEqual(['Fishing']);
  });

  // Removing has to work regardless of how the tag was typed this time.
  it('removes by meaning, not by exact spelling', () => {
    expect(toggleTag(['Cold nights'], 'cold nights')).toEqual([]);
  });

  it('stores the canonical spelling when adding a known tag', () => {
    expect(toggleTag([], 'hiking', ['Hiking'])).toEqual(['Hiking']);
  });

  it('ignores an empty tag rather than storing a blank', () => {
    expect(toggleTag(['Hiking'], '   ')).toEqual(['Hiking']);
  });
});

describe('toCalendarDate', () => {
  /**
   * Noon, not midnight. A trip date is a calendar DAY, and midnight is the one moment of the
   * day that isn't guaranteed to exist — some timezones skip it outright on a DST transition,
   * and west of UTC it serializes as the previous day. Noon is twelve hours clear of both.
   */
  it('pins a picked instant to noon on the same local day', () => {
    const picked = new Date(2026, 8, 4, 23, 47, 12);
    const day = toCalendarDate(picked);

    expect(day.getFullYear()).toBe(2026);
    expect(day.getMonth()).toBe(8);
    expect(day.getDate()).toBe(4);
    expect(day.getHours()).toBe(12);
  });

  // The bug this guards: an early-morning pick rounding down to the previous day.
  it('keeps the day the user tapped, whatever the time on it', () => {
    for (const hour of [0, 1, 11, 12, 13, 23]) {
      expect(toCalendarDate(new Date(2026, 2, 1, hour)).getDate()).toBe(1);
    }
  });
});

describe('formatDateRange', () => {
  const during2026 = new Date(2026, 5, 1);

  it('collapses a same-month range to one month name', () => {
    expect(formatDateRange(new Date(2026, 8, 4), new Date(2026, 8, 7), during2026)).toBe(
      'Sep 4–7',
    );
  });

  it('spells both months when the trip crosses one', () => {
    expect(formatDateRange(new Date(2026, 8, 28), new Date(2026, 9, 2), during2026)).toBe(
      'Sep 28 – Oct 2',
    );
  });

  it('prints a lone departure date', () => {
    expect(formatDateRange(new Date(2026, 8, 4), undefined, during2026)).toBe('Sep 4');
  });

  // Half a range is not a date: nothing derives from a return with nowhere to return from.
  it('produces nothing from a return date alone', () => {
    expect(formatDateRange(undefined, new Date(2026, 8, 7), during2026)).toBeUndefined();
    expect(formatDateRange(null, null, during2026)).toBeUndefined();
  });

  // The year is noise eleven months out of twelve and essential the twelfth.
  it('adds the year only when the trip is not in the current one', () => {
    expect(formatDateRange(new Date(2027, 0, 3), undefined, during2026)).toBe('Jan 3, 2027');
    expect(formatDateRange(new Date(2026, 0, 3), undefined, during2026)).toBe('Jan 3');
  });

  // A return that isn't after the departure is stale, not a range.
  it('falls back to the departure day when the range is inverted or empty', () => {
    expect(formatDateRange(new Date(2026, 8, 7), new Date(2026, 8, 4), during2026)).toBe('Sep 7');
    expect(formatDateRange(new Date(2026, 8, 7), new Date(2026, 8, 7), during2026)).toBe('Sep 7');
  });
});

describe('tripSummary', () => {
  const during2026 = new Date(2026, 5, 1);

  // Dates, not season. Season is derived FROM the departure date, so printing both would state
  // one fact twice — and of the two it's the dates that tell you WHICH trip this is.
  it('reads destination, dates, setting, headcount', () => {
    expect(
      tripSummary(
        {
          destination: 'Uintas',
          departAt: new Date(2026, 8, 4),
          returnAt: new Date(2026, 8, 7),
          lodgings: ['Tent'],
          attendeeCount: 3,
        },
        during2026,
      ),
    ).toBe('Uintas · Sep 4–7 · Tent · 3 going');
  });

  // A half-filled trip is the normal case, so missing parts have to drop out cleanly rather
  // than leaving stray separators behind.
  it('omits what it does not know', () => {
    expect(tripSummary({ destination: 'Uintas' })).toBe('Uintas');
    expect(tripSummary({ lodgings: ['Hotel'], attendeeCount: 1 })).toBe('Hotel · 1 going');
    expect(tripSummary({})).toBe('');
  });

  // Lodging is a label now, so an unfamiliar one is shown rather than swallowed — that IS
  // the point of an open axis.
  it('shows a lodging it has never seen', () => {
    expect(tripSummary({ destination: 'Uintas', lodgings: ['Yurt'] })).toBe('Uintas · Yurt');
  });
});

describe('metadataCompleteness', () => {
  it('is zero for a trip that is only a name', () => {
    expect(metadataCompleteness({})).toEqual({ filled: 0, total: 10 });
  });

  it('is complete when every axis is filled', () => {
    const full = metadataCompleteness({
      tripTypes: ['Camping'],
      travelModes: ['Driving'],
      lodgings: ['Tent'],
      destination: 'Uintas',
      departAt: new Date('2026-09-04'),
      activities: ['Hiking'],
      conditions: ['Cold nights'],
      attendeeCount: 3,
    });
    expect(full.filled).toBe(full.total);
  });

  // Trip type decides which suggestions load at all, and who is going discriminates hardest
  // between past trips. Both count double.
  it('weights attendees and trip type above the rest', () => {
    const who = metadataCompleteness({ attendeeCount: 2 }).filled;
    const where = metadataCompleteness({ destination: 'Uintas' }).filled;
    expect(who).toBeGreaterThan(where);
    expect(metadataCompleteness({ tripTypes: ['Camping'] }).filled).toBeGreaterThan(where);
  });

  it('does not count an empty selection as filled', () => {
    expect(metadataCompleteness({ activities: [], conditions: [] }).filled).toBe(0);
  });
});


