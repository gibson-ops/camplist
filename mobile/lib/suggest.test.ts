import { namesOnList, suggestFor } from './suggest';
import type { PackedTripRow } from './itemHistory';

const NOW = +new Date('2026-07-28T12:00:00');

const CAMPING = {
  tripTypes: ['Camping'],
  travelModes: ['Driving'],
  lodgings: ['Tent'],
  conditions: ['Cold nights'],
  attendees: [{ id: 'jared' }],
};

const TRIP: PackedTripRow = { ...CAMPING, id: 'next', name: 'Next', departAt: '2026-09-04' };

/** A past trip of the same shape, carrying whatever it packed on its shared list. */
const pastTrip = (
  id: string,
  items: string[],
  extra: Partial<PackedTripRow> = {},
): PackedTripRow => ({
  ...CAMPING,
  id,
  name: id,
  departAt: '2025-09-04',
  lists: [{ items: items.map((name) => ({ name, state: 'loaded' })) }],
  ...extra,
});

const ask = (past: PackedTripRow[], over: Partial<Parameters<typeof suggestFor>[0]> = {}) =>
  suggestFor({ trip: TRIP, past, now: NOW, limit: 8, ...over });

const names = (past: PackedTripRow[], over = {}) => ask(past, over).map((s) => s.name);

describe('suggestFor', () => {
  it('falls back to seeds for a household with no history', () => {
    const out = ask([]);
    expect(out.length).toBeGreaterThan(0);
    // Tent came from the shipped table, not from a trip.
    expect(out.every((s) => s.from.length === 0)).toBe(true);
    expect(names([])).toContain('Tent');
  });

  /** The whole thesis in one assertion. */
  it('puts what the household actually packed above what the app guessed', () => {
    const out = ask([pastTrip('uintas', ['Percolator'])]);
    expect(out[0].name).toBe('Percolator');
    expect(out[0].from.map((t) => t.name)).toEqual(['uintas']);
  });

  it('offers a thing once even when both sources know about it', () => {
    const out = ask([pastTrip('uintas', ['Tent'])]);
    expect(out.filter((s) => s.name === 'Tent')).toHaveLength(1);
    // And it's the history version, which can say where it came from.
    expect(out.find((s) => s.name === 'Tent')?.from).toHaveLength(1);
  });

  /**
   * The hole a naive "history first, seeds fill" leaves. A household with enough history to fill
   * the screen adds one genuinely new thing to a trip, and that one thing is what gets pushed
   * off the bottom — the only item on the list anybody could actually forget.
   */
  it('leads with gear for a tag the household has never packed for', () => {
    const history = Array.from({ length: 4 }, (_, i) =>
      pastTrip(`trip-${i}`, [
        'Tent',
        'Sleeping bag',
        'Camp stove',
        'Headlamp',
        'Cooler',
        'Firewood',
      ]),
    );

    const fishing = { ...TRIP, activities: ['Fishing'] };
    const out = suggestFor({ trip: fishing, past: history, now: NOW, limit: 8 });

    expect(out[0].name).toBe('Rod and reel');
    expect(out[0].from).toEqual([]);
  });

  /**
   * The cap in the other direction: three activities nobody has ever done produce nine seeds,
   * and unchecked they'd push the tent — packed on every trip for four years — off the screen.
   */
  it('never lets new tags crowd out what the household always packs', () => {
    const history = Array.from({ length: 3 }, (_, i) =>
      pastTrip(`trip-${i}`, ['Tent', 'Camp stove']),
    );
    const busy = { ...TRIP, activities: ['Fishing', 'Climbing', 'Paddling'] };

    const out = suggestFor({ trip: busy, past: history, now: NOW, limit: 8 });

    expect(out.filter((s) => s.from.length > 0).length).toBeGreaterThanOrEqual(2);
    expect(out.map((s) => s.name)).toContain('Tent');
  });

  /** Seeds must not make the app dumber the longer you use it. */
  it('hands the whole budget to history when nothing about the trip is new', () => {
    const packed = ['Tent', 'Tent stakes', 'Sleeping bag', 'Sleeping pad', 'Headlamp'];
    const extras = ['Percolator', 'Camp quilt', 'Dutch oven', 'Lantern', 'Axe'];
    const past = [pastTrip('a', [...packed, ...extras]), pastTrip('b', [...packed, ...extras])];

    // Every tag on this trip is one the past trips carried, so the app has nothing to add.
    const out = ask(past, { limit: 6 });
    expect(out).toHaveLength(6);
    expect(out.every((s) => s.from.length > 0)).toBe(true);
  });

  it('never offers something already on the list', () => {
    const out = names([pastTrip('uintas', ['Percolator', 'Tent'])], { onList: ['percolator'] });
    expect(out).not.toContain('Percolator');
  });

  it('never offers something turned down, whichever source it came from', () => {
    const out = names([pastTrip('uintas', ['Percolator'])], { dismissed: ['Percolator', 'Tent'] });
    expect(out).not.toContain('Percolator');
    expect(out).not.toContain('Tent');
  });

  /**
   * A cooler is nobody's in particular and a sleeping bag is something each of you brings your
   * own of. Opening "Add item" under a person's list has already answered which kind is wanted.
   */
  it('narrows both sources to what belongs on the list being added to', () => {
    const past = [
      {
        ...pastTrip('uintas', ['Percolator']),
        lists: [
          { items: [{ name: 'Percolator', state: 'loaded' }] },
          { owner: { id: 'jared' }, items: [{ name: 'Wool socks', state: 'loaded' }] },
        ],
      },
    ];

    expect(names(past, { sharing: 'each' })).toContain('Wool socks');
    expect(names(past, { sharing: 'each' })).not.toContain('Percolator');
    expect(names(past, { sharing: 'one' })).toContain('Percolator');
    expect(names(past, { sharing: 'one' })).not.toContain('Wool socks');
  });

  it('respects the budget it was given', () => {
    const past = [
      pastTrip(
        'uintas',
        Array.from({ length: 40 }, (_, i) => `Thing ${i}`),
      ),
    ];
    expect(ask(past, { limit: 5 })).toHaveLength(5);
  });

  /**
   * The only input in the system that came from a person rather than an inference, and the only
   * one that can name something no list has ever held.
   */
  it('leads with what someone said they wished they had', () => {
    const out = ask([pastTrip('uintas', ['Percolator', 'Tent'])], {
      verdicts: { promoted: [{ name: 'Second lantern', sharing: 'one' }], demoted: [] },
    });

    expect(out[0].name).toBe('Second lantern');
  });

  /**
   * Sunk, not silenced: it still shows whenever the budget has room, and only falls off when
   * something better needs the slot. One note from one trip should be able to lose an argument
   * with better evidence, not win one on its own.
   */
  it('sinks what turned out not to be needed below everything else', () => {
    const past = [pastTrip('uintas', ['Percolator', 'Axe', 'Tent'])];
    const roomy = names(past, { verdicts: { promoted: [], demoted: ['Percolator'] }, limit: 30 });

    expect(roomy).toContain('Percolator');
    expect(roomy.indexOf('Percolator')).toBeGreaterThan(roomy.indexOf('Tent'));
    expect(roomy.indexOf('Percolator')).toBeGreaterThan(roomy.indexOf('Axe'));
  });

  it('lets a tight budget cut a sunk suggestion, but never a promoted one', () => {
    const past = [pastTrip('uintas', ['Percolator', 'Axe', 'Tent'])];
    const tight = names(past, { verdicts: { promoted: [], demoted: ['Percolator'] }, limit: 3 });

    expect(tight).not.toContain('Percolator');
  });

  it('offers a wished-for thing once even when history already had it', () => {
    const out = ask([pastTrip('uintas', ['Percolator'])], {
      verdicts: { promoted: [{ name: 'Percolator', sharing: 'one' }], demoted: [] },
    });

    expect(out.filter((s) => s.name === 'Percolator')).toHaveLength(1);
    expect(out[0].name).toBe('Percolator');
  });

  it('still drops a wished-for thing that is already on the list', () => {
    const out = names([pastTrip('uintas', ['Tent'])], {
      onList: ['Second lantern'],
      verdicts: { promoted: [{ name: 'Second lantern', sharing: 'one' }], demoted: [] },
    });

    expect(out).not.toContain('Second lantern');
  });

  it('ignores a past trip that is nothing like this one', () => {
    const conference = pastTrip('chicago', ['Business cards'], {
      tripTypes: ['Work'],
      travelModes: ['Flying'],
      lodgings: ['Hotel'],
      conditions: ['Formal dress'],
      attendees: [{ id: 'someone' }],
    });

    expect(names([conference])).not.toContain('Business cards');
  });
});

/**
 * A kit is a container of coverage: if the kitchen box holds a skillet, this trip HAS a skillet.
 * Both callers used to build the exclusion set from top-level rows only, so anything inside a kit
 * was invisible and got suggested again — Jared hit it with gear he was already carrying.
 */
/**
 * NOVEL-TAG SEEDS LEAD ONLY ONCE HISTORY CONTAINS HABITS.
 *
 * The novel rule trades certainty for salience: a guess about the new part of a trip goes ahead of
 * evidence about the rest, because history's best answers are the things you pack every time and
 * would never forget. That argument needs history to hold habits. With one matching trip every
 * history item is a single observation — the most specific thing the app knows — and a shipped
 * seed table outranking it inverts evidence and guess.
 *
 * Measured on real data before this rule existed: learned items arrived last, behind generic
 * personal-list seeds. Replaying three real trips, missed went 63 -> 57 and noise 21 -> 15.
 */
describe('novel tags versus history', () => {
  // A trip shape whose 'Fishing' tag no past trip carries, so its seeds count as novel.
  const FISHING = { ...TRIP, activities: ['Fishing'] };
  const askFishing = (past: PackedTripRow[]) =>
    suggestFor({ trip: FISHING, past, now: NOW, limit: 8 }).map((s) => s.name);

  it('puts one trip’s evidence ahead of a guess about a new tag', () => {
    const offered = askFishing([pastTrip('only', ['Percolator'])]);

    expect(offered).toContain('Percolator');
    // Ahead of anything the seed table volunteered for the novel tag.
    expect(offered.indexOf('Percolator')).toBe(0);
  });

  it('lets the new part of the trip lead once history is a pattern', () => {
    const offered = askFishing([pastTrip('one', ['Percolator']), pastTrip('two', ['Percolator'])]);

    // Two trips make the percolator a habit — the thing least likely to be forgotten — so the
    // fishing gear, which has never been packed here, earns the top of the list.
    expect(offered[0]).not.toBe('Percolator');
    expect(offered).toContain('Percolator');
  });
});

describe('namesOnList', () => {
  it('counts what is inside a kit, not just the kit', () => {
    const names = namesOnList([
      { name: 'Kitchen box', children: [{ name: 'Skillet' }, { name: 'Tongs' }] },
      { name: 'Sleeping bag' },
    ]);
    expect(names).toEqual(['Kitchen box', 'Skillet', 'Tongs', 'Sleeping bag']);
  });

  it('handles rows with no contents at all', () => {
    expect(namesOnList([{ name: 'Lantern' }])).toEqual(['Lantern']);
  });

  // The point of the whole thing: a suggestion is noise if the trip already carries it.
  it('stops something already in a kit from being suggested', () => {
    const covered = suggestFor({
      trip: { id: 't', activities: ['Cooking'] } as unknown as PackedTripRow,
      past: [],
      onList: namesOnList([{ name: 'Kitchen box', children: [{ name: 'Skillet' }] }]),
    });
    expect(covered.map((s) => s.name)).not.toContain('Skillet');
  });
});
