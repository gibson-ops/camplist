import {
  MATCH_FLOOR,
  rankTrips,
  recencyWeight,
  shapeOf,
  similarity,
  wasTaken,
  type TripRow,
} from './similarity';

const NOW = +new Date('2026-07-28T12:00:00');
const YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** A fully described camping trip, and the baseline everything else is compared against. */
const UINTAS: TripRow = {
  id: 'uintas',
  name: 'Uintas, Labor Day',
  tripTypes: ['Camping'],
  travelModes: ['Driving'],
  lodgings: ['Tent'],
  activities: ['Fishing'],
  conditions: ['Cold nights'],
  destination: 'Mirror Lake',
  departAt: '2025-09-04',
  attendees: [{ id: 'jared' }, { id: 'brooke' }, { id: 'walker' }],
};

const shape = (row: TripRow) => shapeOf(row, NOW);

describe('similarity', () => {
  it('is 1 for a trip described exactly the same way', () => {
    expect(similarity(shape(UINTAS), shape({ ...UINTAS, id: 'other' }))).toBe(1);
  });

  it('is 0 when nothing about the two trips agrees', () => {
    const beach = shape({
      id: 'beach',
      tripTypes: ['Vacation'],
      travelModes: ['Flying'],
      lodgings: ['Hotel'],
      activities: ['Swimming'],
      conditions: ['Hot days'],
      destination: 'San Diego',
      departAt: '2025-02-10',
      attendees: [{ id: 'someone-else' }],
    });

    expect(similarity(shape(UINTAS), beach)).toBe(0);
  });

  /**
   * The rule that keeps a half-described trip usable. Scoring an unanswered axis as a miss would
   * drag every candidate under MATCH_FLOOR and leave a household with history it can't reach.
   */
  it('ignores axes the current trip is silent about', () => {
    const bare = shape({ id: 'bare', tripTypes: ['Camping'] });
    // Everything but the type is unanswered on the current trip, so only the type is scored.
    expect(similarity(bare, shape(UINTAS))).toBe(1);
  });

  it('counts an axis the PAST trip is silent about as a miss', () => {
    const vague = shape({ id: 'vague', tripTypes: ['Camping'] });
    const full = shape({ ...UINTAS, id: 'full' });

    // The reverse of the test above: this trip named a lodging and that one never did, so it
    // cannot be evidence about tents.
    expect(similarity(full, vague)).toBeLessThan(1);
    expect(similarity(full, vague)).toBeGreaterThan(0);
  });

  /**
   * Jaccard rather than coverage. Under coverage the over-described trip covers everything
   * perfectly, becomes the top match for every future trip, and dumps its whole list into the
   * suggestions.
   */
  it('prefers a focused match over a trip that also did other things', () => {
    const focused = shape({ id: 'focused', tripTypes: ['Camping'], activities: ['Fishing'] });
    const sprawling = shape({
      id: 'sprawling',
      tripTypes: ['Camping', 'Visiting people'],
      activities: ['Fishing', 'Skiing', 'Presenting'],
    });
    const current = shape({ id: 'current', tripTypes: ['Camping'], activities: ['Fishing'] });

    expect(similarity(current, focused)).toBeGreaterThan(similarity(current, sprawling));
  });

  it('matches however the household spells a tag', () => {
    const a = shape({ id: 'a', tripTypes: ['Camping'], conditions: ['Cold nights'] });
    const b = shape({ id: 'b', tripTypes: ['camping'], conditions: ['COLD NIGHTS'] });
    expect(similarity(a, b)).toBe(1);
  });

  /**
   * Base rates. Every trip a household takes has roughly the same people on it, so agreement
   * there has to be worth much less than agreement about sleeping in a tent — otherwise the
   * matcher would think a wedding resembles a backpacking trip.
   */
  it('does not let a shared household outweigh a different kind of trip', () => {
    const current = shape(UINTAS);
    const samePeopleDifferentTrip = shape({
      id: 'wedding',
      tripTypes: ['Event'],
      travelModes: ['Flying'],
      lodgings: ['Hotel'],
      activities: ['Ceremony'],
      conditions: ['Formal dress'],
      destination: 'Chicago',
      departAt: '2025-09-04',
      attendees: UINTAS.attendees,
    });

    expect(similarity(current, samePeopleDifferentTrip)).toBeLessThan(MATCH_FLOOR);
  });

  /**
   * The weight order itself, stated as the product claim it is. The test above only proves the
   * floor holds; this one proves WHY it holds, and fails the moment the axes get reordered.
   */
  it('counts agreement about where you sleep for more than agreement about who is coming', () => {
    const current = shape({
      id: 'current',
      lodgings: ['Tent'],
      attendees: [{ id: 'jared' }, { id: 'brooke' }],
    });
    const sameBed = shape({ id: 'bed', lodgings: ['Tent'], attendees: [{ id: 'someone' }] });
    const samePeople = shape({
      id: 'people',
      lodgings: ['Hotel'],
      attendees: [{ id: 'jared' }, { id: 'brooke' }],
    });

    expect(similarity(current, sameBed)).toBeGreaterThan(similarity(current, samePeople));
  });

  it('scores a trip with nothing to compare as 0 rather than dividing by zero', () => {
    expect(similarity(shape({ id: 'blank' }), shape(UINTAS))).toBe(0);
  });
});

describe('recencyWeight', () => {
  it('is full weight for something that just happened', () => {
    expect(recencyWeight(NOW, NOW)).toBe(1);
  });

  /**
   * The most useful trip a packing app will ever see is the same trip last year, so age is a
   * gentle discount rather than a decay. A hard decay is exactly the rule that throws the annual
   * trip away.
   */
  it('still trusts last year’s trip nearly as much as last month’s', () => {
    expect(recencyWeight(NOW - YEAR, NOW)).toBeGreaterThan(0.85);
  });

  it('never discounts an old trip below the floor', () => {
    expect(recencyWeight(NOW - 20 * YEAR, NOW)).toBeGreaterThan(0.69);
  });

  it('ranks a recent trip above an old one', () => {
    expect(recencyWeight(NOW - YEAR, NOW)).toBeGreaterThan(recencyWeight(NOW - 5 * YEAR, NOW));
  });
});

describe('wasTaken', () => {
  it('is true once the departure date has passed', () => {
    expect(wasTaken({ id: 't', departAt: '2025-09-04' }, NOW)).toBe(true);
  });

  it('is false for a trip that hasn’t left yet', () => {
    expect(wasTaken({ id: 't', departAt: '2026-09-04' }, NOW)).toBe(false);
  });

  it('is true for an archived trip with no dates at all', () => {
    expect(wasTaken({ id: 't', status: 'archived' }, NOW)).toBe(true);
  });

  /**
   * The honest signal: dates are optional and nobody archives anything, but a packed item is the
   * user's own testimony that they stood in front of a pile of gear with this list open.
   */
  it('is true when something on it actually got packed', () => {
    const trip = { id: 't', lists: [{ items: [{ state: 'unpacked' }, { state: 'loaded' }] }] };
    expect(wasTaken(trip, NOW)).toBe(true);
  });

  it('is false for a future trip whose list is written but untouched', () => {
    const trip = {
      id: 't',
      departAt: '2026-09-04',
      lists: [{ items: [{ state: 'unpacked' }, { state: 'unpacked' }] }],
    };
    expect(wasTaken(trip, NOW)).toBe(false);
  });
});

describe('rankTrips', () => {
  const past: TripRow[] = [
    UINTAS,
    {
      id: 'moab',
      name: 'Moab',
      tripTypes: ['Camping'],
      travelModes: ['Driving'],
      lodgings: ['Tent'],
      activities: ['Biking'],
      conditions: ['Hot days'],
      departAt: '2025-04-10',
      attendees: [{ id: 'jared' }, { id: 'brooke' }],
    },
    {
      id: 'chicago',
      name: 'Chicago',
      tripTypes: ['Work'],
      travelModes: ['Flying'],
      lodgings: ['Hotel'],
      activities: ['Presenting'],
      conditions: ['Formal dress'],
      departAt: '2025-06-01',
      attendees: [{ id: 'jared' }],
    },
  ];

  const current = shape({ ...UINTAS, id: 'next', departAt: '2026-09-04' });

  it('ranks trips of the same shape above trips of a different one', () => {
    const ranked = rankTrips(current, past, NOW);
    expect(ranked.map((r) => r.shape.id)).toEqual(['uintas', 'moab']);
  });

  it('drops everything under the floor rather than returning a best-of-a-bad-lot', () => {
    expect(rankTrips(current, past, NOW).some((r) => r.shape.id === 'chicago')).toBe(false);
  });

  it('never matches a trip against itself', () => {
    const self = shape(UINTAS);
    expect(rankTrips(self, past, NOW).some((r) => r.shape.id === 'uintas')).toBe(false);
  });

  /**
   * The feedback loop this exists to break: the app suggests something, the user accepts it, the
   * trip is abandoned, and the accepted suggestion comes back as evidence for itself.
   */
  it('halves the vote of a trip that never happened', () => {
    const planned: TripRow = { ...UINTAS, id: 'planned', departAt: '2027-09-04' };
    const [taken, notTaken] = [
      rankTrips(current, [UINTAS], NOW)[0],
      rankTrips(current, [planned], NOW)[0],
    ];

    expect(notTaken.score).toBeCloseTo(taken.score);
    expect(notTaken.weight).toBeLessThan(taken.weight * 0.6);
  });

  /** Age weights the vote; it must not push a still-relevant trip under the floor. */
  it('keeps an old identical trip above the floor', () => {
    const ancient: TripRow = { ...UINTAS, id: 'ancient', departAt: '2019-09-04' };
    const ranked = rankTrips(current, [ancient], NOW);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].score).toBe(1);
    expect(ranked[0].weight).toBeLessThan(1);
  });

  it('has nothing to say for a household with no history', () => {
    expect(rankTrips(current, [], NOW)).toEqual([]);
  });
});
