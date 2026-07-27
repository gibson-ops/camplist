import {
  ACTIVITIES,
  CONDITIONS,
  SETTINGS,
  labelsFor,
  metadataCompleteness,
  parseVocab,
  seasonOf,
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

describe('tripSummary', () => {
  it('reads destination, season, setting, headcount', () => {
    expect(
      tripSummary({
        destination: 'Uintas',
        departAt: new Date('2026-09-04'),
        setting: 'car',
        attendeeCount: 3,
      }),
    ).toBe('Uintas · Fall · Car camping · 3 going');
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
