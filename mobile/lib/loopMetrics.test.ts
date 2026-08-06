import { replayAll, replayTrip, totals } from './loopMetrics';

/**
 * A trip, with just enough on it to be judged. Camping + tent, because the shipped seeds have
 * plenty to say about that — the point of these tests is the REPLAY, not the matcher.
 */
const tripAt = (
  id: string,
  createdAt: string,
  items: { name: string; group?: { id: string } | null; oneOff?: boolean }[],
  extra: Record<string, unknown> = {},
) =>
  ({
    id,
    name: id,
    createdAt,
    status: 'planning',
    isTemplate: false,
    tripTypes: ['Camping'],
    lodgings: ['Tent'],
    lists: [{ items: items.map((i, n) => ({ state: 'unpacked', sortOrder: n, ...i })) }],
    ...extra,
  }) as Parameters<typeof replayTrip>[0]['trip'];

describe('replayTrip', () => {
  it('scores what the app would have offered against what went on the list', () => {
    const first = tripAt('first', '2026-01-01', [{ name: 'Tent' }, { name: 'Percolator' }]);
    const second = tripAt('second', '2026-02-01', [{ name: 'Tent' }, { name: 'Ham radio' }]);

    const replay = replayTrip({ trip: second, past: [first] });

    // The tent came from the first trip; nothing could have named a ham radio.
    expect(replay.taken).toContain('Tent');
    expect(replay.missed).toContain('Ham radio');
    expect(replay.missed).not.toContain('Tent');
  });

  it('reports coverage as the share of the list it could name', () => {
    const first = tripAt('first', '2026-01-01', [{ name: 'Percolator' }]);
    const second = tripAt('second', '2026-02-01', [{ name: 'Percolator' }, { name: 'Ham radio' }]);

    expect(replayTrip({ trip: second, past: [first] }).coverage).toBe(0.5);
  });

  it('has no opinion about a trip that listed nothing', () => {
    // 0/0 is not a score of zero, and treating it as one would drag every average.
    expect(replayTrip({ trip: tripAt('empty', '2026-01-01', []), past: [] }).coverage).toBeNull();
  });

  it('counts what it offered and never got taken', () => {
    const replay = replayTrip({
      trip: tripAt('solo', '2026-01-01', [{ name: 'Ham radio' }]),
      past: [],
    });

    // Camping seeds offered plenty; one thing went on the list, and it was not one of them.
    expect(replay.ignored.length).toBeGreaterThan(0);
    expect(replay.ignored).not.toContain('Ham radio');
  });

  /**
   * A KNOWN STRUCTURAL GAP, NOT A MATCHER FAILURE. History skips kit rows on purpose — suggesting
   * one as a plain item makes an empty "Camp kitchen" that reads as handled — so a kit can never
   * be offered. Counting it silently would blame the matcher for a feature nobody has built.
   */
  it('separates a kit from a thing it should have known', () => {
    const first = tripAt('first', '2026-01-01', [
      { name: 'Camp kitchen', group: { id: 'g1' } },
      { name: 'Percolator' },
    ]);
    const second = tripAt('second', '2026-02-01', [
      { name: 'Camp kitchen', group: { id: 'g1' } },
      { name: 'Ham radio' },
    ]);

    const replay = replayTrip({ trip: second, past: [first] });

    expect(replay.kits).toEqual(['Camp kitchen']);
    expect(replay.missed).toContain('Camp kitchen');
    expect(replay.missed).toContain('Ham radio');
  });

  it('marks a one-off, which the app was right not to know', () => {
    const replay = replayTrip({
      trip: tripAt('solo', '2026-01-01', [{ name: 'Costume', oneOff: true }]),
      past: [],
    });

    expect(replay.oneOffs).toEqual(['Costume']);
  });

  /**
   * THE ONE WAY THIS MEASUREMENT CAN LIE IS BY FLATTERING ITSELF, and the reachable version runs
   * through dismissals. Turning a suggestion down during a trip records a note against THAT trip,
   * and `dismissedNames` silences a name the moment its own trip has dismissed it. Feed that back
   * in and the replay concludes the app never offered the hammock — when what actually happened is
   * that it offered one and you said no. The offer disappears from the score instead of counting
   * as noise, which is the app marking its own homework.
   */
  it('does not let a dismissal made on this trip erase the offer it was turned down from', () => {
    const trip = tripAt('solo', '2026-01-01', [{ name: 'Ham radio' }]);

    const replay = replayTrip({
      trip,
      past: [],
      reflections: [{ kind: 'dismissed', name: 'Sleeping bag', trip: { id: 'solo' } }],
    });

    expect(replay.ignored).toContain('Sleeping bag');
  });

  it('still reports the trip’s own regrets, which are the point of recording them', () => {
    const trip = tripAt('solo', '2026-01-01', [{ name: 'Ham radio' }]);
    const replay = replayTrip({
      trip,
      past: [],
      reflections: [
        { kind: 'wished_had', name: 'Second lantern', trip: { id: 'solo' } },
        { kind: 'wished_had', name: 'Not this trip', trip: { id: 'other' } },
      ],
    });

    expect(replay.regrets).toEqual(['Second lantern']);
  });

  /**
   * JUDGED BY THE CLOCK IT WAS CREATED UNDER, not by today's.
   *
   * `wasTaken` decides whether a past trip is evidence or merely intent, and a trip halves its vote
   * until it has actually happened. A trip that had not departed when this one was planned but has
   * departed since would count as full evidence under today's clock — the replay giving the app
   * credit for hindsight it did not have.
   *
   * Both past trips here look identical to the matcher; only their dates differ. As of February the
   * older one had happened and the July one had not, so the percolator outranks the ham radio. Read
   * against any later clock the order flips, because by then the July trip has been taken and is
   * the more recent of the two.
   */
  it('weighs past trips as they stood when this one was created', () => {
    const happened = tripAt('happened', '2025-01-01', [{ name: 'Percolator' }], {
      departAt: '2025-02-01',
    });
    const notYet = tripAt('notYet', '2026-01-01', [{ name: 'Ham radio' }], {
      departAt: '2026-07-01',
    });
    const planning = tripAt('planning', '2026-02-01', [
      { name: 'Percolator' },
      { name: 'Ham radio' },
    ]);

    // One slot, so the ordering is the whole assertion rather than a detail inside a long list.
    const replay = replayTrip({ trip: planning, past: [happened, notYet], limit: 1 });

    expect(replay.taken).toEqual(['Percolator']);
    expect(replay.missed).toContain('Ham radio');
  });

  it('uses a reflection from an EARLIER trip, which the app really did have', () => {
    const first = tripAt('first', '2026-01-01', [{ name: 'Percolator' }]);
    const second = tripAt('second', '2026-02-01', [{ name: 'Second lantern' }]);

    const replay = replayTrip({
      trip: second,
      past: [first],
      reflections: [{ kind: 'wished_had', name: 'Second lantern', trip: { id: 'first' } }],
    });

    expect(replay.taken).toContain('Second lantern');
  });
});

describe('replayAll', () => {
  const one = tripAt('one', '2026-01-01', [{ name: 'Percolator' }]);
  const two = tripAt('two', '2026-02-01', [{ name: 'Percolator' }]);
  const three = tripAt('three', '2026-03-01', [{ name: 'Percolator' }]);

  it('judges each trip against only what came before it', () => {
    // The first trip cannot have known a percolator; the later ones can.
    const [newest, middle, oldest] = replayAll({ trips: [three, one, two] });

    expect(oldest.name).toBe('one');
    expect(oldest.missed).toContain('Percolator');
    expect(middle.taken).toContain('Percolator');
    expect(newest.taken).toContain('Percolator');
  });

  it('returns newest first, whatever order the store hands them back', () => {
    expect(replayAll({ trips: [two, three, one] }).map((r) => r.name)).toEqual([
      'three',
      'two',
      'one',
    ]);
  });

  it('skips trips with nothing on them rather than scoring them zero', () => {
    const blank = tripAt('blank', '2026-04-01', []);
    expect(replayAll({ trips: [one, blank] }).map((r) => r.name)).toEqual(['one']);
  });

  it('never lets a later trip inform an earlier one', () => {
    // `three` lists a percolator, but `one` came first and must not benefit from it.
    const [, , oldest] = replayAll({ trips: [one, two, three] });
    expect(oldest.taken).toEqual([]);
  });
});

describe('totals', () => {
  it('adds the three numbers up across trips', () => {
    const summed = totals([
      { taken: ['a'], missed: ['b', 'c'], ignored: ['x'] },
      { taken: ['d'], missed: [], ignored: ['y', 'z'] },
    ] as Parameters<typeof totals>[0]);

    expect(summed).toMatchObject({ trips: 2, taken: 2, missed: 2, ignored: 3, coverage: 0.5 });
  });

  it('has no coverage to report when nothing was judged', () => {
    expect(totals([]).coverage).toBeNull();
  });
});
