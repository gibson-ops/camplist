import { suggestFor } from './suggest';
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
const pastTrip = (id: string, items: string[], extra: Partial<PackedTripRow> = {}): PackedTripRow => ({
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
      pastTrip(`trip-${i}`, ['Tent', 'Sleeping bag', 'Camp stove', 'Headlamp', 'Cooler', 'Firewood']),
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
    const history = Array.from({ length: 3 }, (_, i) => pastTrip(`trip-${i}`, ['Tent', 'Camp stove']));
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
    const past = [pastTrip('uintas', Array.from({ length: 40 }, (_, i) => `Thing ${i}`))];
    expect(ask(past, { limit: 5 })).toHaveLength(5);
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
