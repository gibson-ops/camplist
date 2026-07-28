import {
  ACTIVITIES,
  CONDITIONS,
  SETTINGS,
  formatDateRange,
  labelsFor,
  metadataCompleteness,
  parseVocab,
  seasonOf,
  toCalendarDate,
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

describe('vocabularies', () => {
  // Ids are persisted on every trip that ever selected them. Labels can change freely; an id
  // change silently orphans historical data and breaks exactly the matching this exists for.
  it('have unique, stable, url-safe ids', () => {
    for (const vocab of [SETTINGS, ACTIVITIES, CONDITIONS]) {
      const ids = vocab.map((v) => v.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('never reuse an id across vocabularies', () => {
    const all = [...SETTINGS, ...ACTIVITIES, ...CONDITIONS].map((v) => v.id);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('parseVocab', () => {
  it('keeps only ids the vocabulary actually defines', () => {
    expect(parseVocab(['hiking', 'fishing'], ACTIVITIES)).toEqual(['hiking', 'fishing']);
  });

  // Storage is unvalidated json. A retired id, a typo, or a future shape change must not
  // reach the matcher as if it were a real signal.
  it('drops unknown ids and non-strings', () => {
    expect(parseVocab(['hiking', 'jetskiing', 42, null], ACTIVITIES)).toEqual(['hiking']);
  });

  it('survives junk in the column', () => {
    expect(parseVocab(undefined, ACTIVITIES)).toEqual([]);
    expect(parseVocab('hiking', ACTIVITIES)).toEqual([]);
    expect(parseVocab({ hiking: true }, ACTIVITIES)).toEqual([]);
  });
});

describe('labelsFor', () => {
  it('resolves ids to display labels and skips unknowns', () => {
    expect(labelsFor(['hiking', 'nope', 'fishing'], ACTIVITIES)).toEqual(['Hiking', 'Fishing']);
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
          setting: 'car',
          attendeeCount: 3,
        },
        during2026,
      ),
    ).toBe('Uintas · Sep 4–7 · Car camping · 3 going');
  });

  // A half-filled trip is the normal case, so missing parts have to drop out cleanly rather
  // than leaving stray separators behind.
  it('omits what it does not know', () => {
    expect(tripSummary({ destination: 'Uintas' })).toBe('Uintas');
    expect(tripSummary({ setting: 'backpacking', attendeeCount: 1 })).toBe('Backpacking · 1 going');
    expect(tripSummary({})).toBe('');
  });

  it('ignores a setting id it does not recognise', () => {
    expect(tripSummary({ destination: 'Uintas', setting: 'hovercraft' })).toBe('Uintas');
  });
});

describe('metadataCompleteness', () => {
  it('is zero for a trip that is only a name', () => {
    expect(metadataCompleteness({})).toEqual({ filled: 0, total: 8 });
  });

  it('is complete when every axis is filled', () => {
    const full = metadataCompleteness({
      destination: 'Uintas',
      departAt: new Date('2026-09-04'),
      setting: 'car',
      activities: ['hiking'],
      conditions: ['cold-nights'],
      attendeeCount: 3,
    });
    expect(full.filled).toBe(full.total);
  });

  // Attendees and setting discriminate hardest between past trips, so they count double.
  it('weights attendees and setting above the rest', () => {
    const who = metadataCompleteness({ attendeeCount: 2 }).filled;
    const where = metadataCompleteness({ destination: 'Uintas' }).filled;
    expect(who).toBeGreaterThan(where);
    expect(metadataCompleteness({ setting: 'car' }).filled).toBeGreaterThan(where);
  });

  it('does not count an empty selection as filled', () => {
    expect(metadataCompleteness({ activities: [], conditions: [] }).filled).toBe(0);
  });
});
