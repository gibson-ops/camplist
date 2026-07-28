import {
  ACTIVITY_POOL,
  CONDITION_POOL,
  LODGING,
  TRAVEL,
  TRIP_TYPES,
  canonicalTag,
  dedupeTags,
  formatDateRange,
  labelOf,
  lodgingOf,
  metadataCompleteness,
  parseTags,
  seasonOf,
  slugify,
  suggestedLodging,
  suggestedTags,
  toCalendarDate,
  toggleTag,
  tripSummary,
} from './tripMeta';

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

describe('closed axes', () => {
  /**
   * Type, travel and lodging are STRUCTURAL — the trip type decides which suggestions load and
   * code branches on the values, so an id change silently orphans history. Labels are free to
   * change; ids are not. (Tags follow the opposite rule; see below.)
   */
  it('have unique, stable, url-safe ids', () => {
    for (const axis of [TRIP_TYPES, TRAVEL, LODGING]) {
      const ids = axis.map((v) => v.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('never reuse an id across axes', () => {
    const all = [...TRIP_TYPES, ...TRAVEL, ...LODGING].map((v) => v.id);
    expect(new Set(all).size).toBe(all.length);
  });

  // Every trip type has to offer somewhere to sleep, or the funnel hands back a blank field.
  it('offer lodging for every trip type', () => {
    for (const type of TRIP_TYPES) {
      expect(suggestedLodging(type.id).length).toBeGreaterThan(0);
    }
  });

  it('narrow lodging to what suits the trip type', () => {
    const camping = suggestedLodging('camping').map((l) => l.id);
    expect(camping).toContain('tent');
    expect(camping).not.toContain('hotel');

    const work = suggestedLodging('work').map((l) => l.id);
    expect(work).toContain('hotel');
    expect(work).not.toContain('tent');
  });

  // Changing the trip type must never silently drop an answer already given.
  it('keep the current lodging on offer even when the type would not suggest it', () => {
    expect(suggestedLodging('work', 'tent').map((l) => l.id)).toContain('tent');
  });

  it('fall back to every option when the type is unknown or unset', () => {
    expect(suggestedLodging(undefined)).toHaveLength(LODGING.length);
    expect(suggestedLodging('spelunking')).toHaveLength(LODGING.length);
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
   * The opposite of the old vocabulary guard, on purpose: an unrecognised tag is the POINT of
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

describe('suggestedTags', () => {
  it('offers what suits the trip type', () => {
    expect(suggestedTags('activities', 'work', [])).toContain('Presenting');
    expect(suggestedTags('activities', 'camping', [])).toContain('Fishing');
  });

  /**
   * Changing the trip type may change what ELSE is on offer, but it can never hide something
   * already picked — that would silently drop an answer the moment a type got corrected.
   */
  it('always shows what is already selected, however off-type it is', () => {
    const shown = suggestedTags('activities', 'work', ['Rockhounding']);
    expect(shown[0]).toBe('Rockhounding');
  });

  it('does not show a selected tag twice when it is also a default', () => {
    const shown = suggestedTags('activities', 'camping', ['Fishing']);
    expect(shown.filter((tag) => tag === 'Fishing')).toHaveLength(1);
  });

  // Camping is the centre of gravity, so an undescribed trip gets camping's list rather than
  // an empty one. See PRODUCT.md.
  it('falls back to camping when the type is unknown', () => {
    expect(suggestedTags('activities', undefined, [])).toEqual(
      suggestedTags('activities', 'camping', []),
    );
  });

  // A wall of chips is what this replaced. Six-ish per type is the budget.
  it('keeps the default row short', () => {
    for (const type of TRIP_TYPES) {
      expect(suggestedTags('activities', type.id, []).length).toBeLessThanOrEqual(7);
      expect(suggestedTags('conditions', type.id, []).length).toBeLessThanOrEqual(7);
    }
  });
});

describe('tag pools', () => {
  it('contain every default plus the browse-only extras', () => {
    for (const type of TRIP_TYPES) {
      for (const tag of suggestedTags('activities', type.id, [])) {
        expect(ACTIVITY_POOL).toContain(tag);
      }
      for (const tag of suggestedTags('conditions', type.id, [])) {
        expect(CONDITION_POOL).toContain(tag);
      }
    }
  });

  it('hold no duplicate spellings', () => {
    for (const pool of [ACTIVITY_POOL, CONDITION_POOL]) {
      expect(new Set(pool.map(slugify)).size).toBe(pool.length);
    }
  });
});

describe('labelOf', () => {
  it('resolves an id and shrugs at an unknown one', () => {
    expect(labelOf('camping', TRIP_TYPES)).toBe('Camping');
    expect(labelOf('hovercraft', TRIP_TYPES)).toBeUndefined();
    expect(labelOf(undefined, TRIP_TYPES)).toBeUndefined();
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
          lodging: 'tent',
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
    expect(tripSummary({ lodging: 'hotel', attendeeCount: 1 })).toBe('Hotel · 1 going');
    expect(tripSummary({})).toBe('');
  });

  it('ignores a lodging id it does not recognise', () => {
    expect(tripSummary({ destination: 'Uintas', lodging: 'hovercraft' })).toBe('Uintas');
  });
});

describe('metadataCompleteness', () => {
  it('is zero for a trip that is only a name', () => {
    expect(metadataCompleteness({})).toEqual({ filled: 0, total: 10 });
  });

  it('is complete when every axis is filled', () => {
    const full = metadataCompleteness({
      tripType: 'camping',
      travel: 'car',
      lodging: 'tent',
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
    expect(metadataCompleteness({ tripType: 'camping' }).filled).toBeGreaterThan(where);
  });

  it('does not count an empty selection as filled', () => {
    expect(metadataCompleteness({ activities: [], conditions: [] }).filled).toBe(0);
  });
});

describe('lodgingOf', () => {
  /**
   * `setting` was the camping-only ancestor of `lodging`. Without a translation an old trip
   * silently drops its lodging out of the summary — data loss that reads like a render bug.
   */
  it('translates the deprecated camping-only field', () => {
    // Car camping is a tent you didn't have to carry.
    expect(lodgingOf({ setting: 'car' })).toBe('tent');
    expect(lodgingOf({ setting: 'rv' })).toBe('rv');
    expect(lodgingOf({ setting: 'cabin' })).toBe('cabin');
    expect(lodgingOf({ setting: 'dispersed' })).toBe('dispersed');
  });

  // The sharpest packing constraint the app knows about; it survived the widening intact.
  it('keeps backpacking as its own thing', () => {
    expect(lodgingOf({ setting: 'backpacking' })).toBe('backpacking');
    expect(LODGING.map((l) => l.id)).toContain('backpacking');
  });

  it('prefers a real lodging value over the deprecated one', () => {
    expect(lodgingOf({ lodging: 'hotel', setting: 'car' })).toBe('hotel');
  });

  it('has nothing to say about a trip with neither', () => {
    expect(lodgingOf({})).toBeUndefined();
  });

  // Every translated value has to land on something the picker can actually show.
  it('only ever produces a real lodging id', () => {
    const ids = new Set(LODGING.map((l) => l.id));
    for (const legacy of ['car', 'backpacking', 'rv', 'cabin', 'dispersed']) {
      expect(ids.has(lodgingOf({ setting: legacy })!)).toBe(true);
    }
  });
});
