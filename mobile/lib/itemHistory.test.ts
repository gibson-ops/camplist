import { suggestFromHistory, type PackedTripRow } from './itemHistory';
import { shapeOf } from './similarity';

const NOW = +new Date('2026-07-28T12:00:00');

/** Shorthand for a trip's contents: one shared list plus a list each. */
function packed(
  id: string,
  shared: string[],
  personal: Record<string, string[]> = {},
): PackedTripRow['lists'] {
  return [
    { items: shared.map((name) => ({ name })) },
    ...Object.entries(personal).map(([owner, names]) => ({
      owner: { id: owner },
      items: names.map((name) => ({ name })),
    })),
  ];
}

const CAMPING: Omit<PackedTripRow, 'id' | 'name' | 'lists'> = {
  tripTypes: ['Camping'],
  travelModes: ['Driving'],
  lodgings: ['Tent'],
  activities: ['Fishing'],
  conditions: ['Cold nights'],
  departAt: '2025-09-04',
  attendees: [{ id: 'jared' }, { id: 'brooke' }],
};

const current = () => shapeOf({ ...CAMPING, id: 'next', departAt: '2026-09-04' }, NOW);

const from = (past: PackedTripRow[]) =>
  suggestFromHistory({ current: current(), past, now: NOW }).items;
const names = (past: PackedTripRow[]) => from(past).map((s) => s.name);

describe('suggestFromHistory', () => {
  it('suggests what a matching past trip actually packed', () => {
    const past: PackedTripRow[] = [
      { ...CAMPING, id: 'uintas', name: 'Uintas', lists: packed('uintas', ['Tent', 'Camp stove']) },
    ];

    expect(names(past)).toEqual(['Tent', 'Camp stove']);
  });

  it('has nothing to say when no past trip is like this one', () => {
    const past: PackedTripRow[] = [
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
        lists: packed('chicago', ['Laptop', 'Business cards']),
      },
    ];

    expect(names(past)).toEqual([]);
  });

  /**
   * The ranking claim: evidence from the trip that resembles this one beats sheer frequency.
   * Frequency alone would surface the household's most generic habits above everything specific,
   * which is the opposite of what all that metadata was collected for.
   */
  it('ranks a close match above something packed more often on distant trips', () => {
    const past: PackedTripRow[] = [
      { ...CAMPING, id: 'twin', name: 'Twin', lists: packed('twin', ['Fishing rod']) },
      // Same people, same season, different everything else — two of them, both weak.
      {
        id: 'wedding-a',
        name: 'Wedding A',
        tripTypes: ['Event'],
        lodgings: ['Hotel'],
        travelModes: ['Driving'],
        activities: ['Ceremony'],
        conditions: ['Cold nights'],
        departAt: '2025-09-10',
        attendees: CAMPING.attendees,
        lists: packed('wedding-a', ['Dress shoes']),
      },
      {
        id: 'wedding-b',
        name: 'Wedding B',
        tripTypes: ['Event'],
        lodgings: ['Hotel'],
        travelModes: ['Driving'],
        activities: ['Ceremony'],
        conditions: ['Cold nights'],
        departAt: '2025-10-10',
        attendees: CAMPING.attendees,
        lists: packed('wedding-b', ['Dress shoes']),
      },
    ];

    expect(names(past)[0]).toBe('Fishing rod');
  });

  /**
   * A towel on all four people's lists is one household decision, not four. Counting each
   * instance would let a big family's personal items bury the tent — the expensive thing to
   * forget — under four toothbrushes.
   */
  it('counts an item on every personal list as one piece of evidence', () => {
    const past: PackedTripRow[] = [
      {
        ...CAMPING,
        id: 'uintas',
        name: 'Uintas',
        lists: packed('uintas', ['Tent'], { jared: ['Towel'], brooke: ['Towel'] }),
      },
    ];

    const [first, second] = from(past);
    expect(first.name).toBe('Tent');
    expect(first.weight).toBeCloseTo(second.weight);
    expect(second.trips).toBe(1);
  });

  it('marks something everyone brought their own of as each', () => {
    const past: PackedTripRow[] = [
      {
        ...CAMPING,
        id: 'uintas',
        name: 'Uintas',
        lists: packed('uintas', ['Tent'], { jared: ['Sleeping bag'] }),
      },
    ];

    const byName = new Map(from(past).map((s) => [s.name, s]));
    expect(byName.get('Sleeping bag')?.sharing).toBe('each');
    expect(byName.get('Tent')?.sharing).toBe('one');
  });

  /** The older way of saying the same thing, still stored on trips packed before the change. */
  it('reads a legacy each-item on the shared list as each', () => {
    const past: PackedTripRow[] = [
      {
        ...CAMPING,
        id: 'uintas',
        name: 'Uintas',
        lists: [{ items: [{ name: 'Toothbrush', sharing: 'each' }] }],
      },
    ];

    expect(from(past)[0].sharing).toBe('each');
  });

  /**
   * An empty "Camp kitchen" row reads as handled and isn't. A kit is a template plus a row that
   * stands for the box, and neither survives being copied as a plain item.
   */
  it('never suggests a kit as if it were a thing', () => {
    const past: PackedTripRow[] = [
      {
        ...CAMPING,
        id: 'uintas',
        name: 'Uintas',
        lists: [
          { items: [{ name: 'Camp kitchen', group: { id: 'g1' } }, { name: 'Tent' }] },
        ],
      },
    ];

    expect(names(past)).toEqual(['Tent']);
  });

  it('carries consumables across so the kit gate still applies', () => {
    const past: PackedTripRow[] = [
      {
        ...CAMPING,
        id: 'uintas',
        name: 'Uintas',
        lists: [{ items: [{ name: 'Propane', consumable: true }, { name: 'Tent' }] }],
      },
    ];

    const byName = new Map(from(past).map((s) => [s.name, s]));
    expect(byName.get('Propane')?.consumable).toBe(true);
    expect(byName.get('Tent')?.consumable).toBe(false);
  });

  /** What lets a suggestion explain itself, which is what makes it dismissable rather than odd. */
  it('names the trips a suggestion came from, best match first', () => {
    const past: PackedTripRow[] = [
      { ...CAMPING, id: 'far', name: 'Moab', activities: ['Biking'], lists: packed('far', ['Tent']) },
      { ...CAMPING, id: 'near', name: 'Uintas', lists: packed('near', ['Tent']) },
    ];

    const [tent] = from(past);
    expect(tent.trips).toBe(2);
    expect(tent.from.map((t) => t.name)).toEqual(['Uintas', 'Moab']);
  });

  it('keeps the spelling the closest trip used', () => {
    const past: PackedTripRow[] = [
      { ...CAMPING, id: 'far', name: 'Moab', activities: ['Biking'], lists: packed('far', ['tent']) },
      { ...CAMPING, id: 'near', name: 'Uintas', lists: packed('near', ['Tent']) },
    ];

    expect(names(past)).toEqual(['Tent']);
  });

  it('is empty for a household with no history', () => {
    expect(names([])).toEqual([]);
  });
});
