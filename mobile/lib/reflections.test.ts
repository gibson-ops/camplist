import { isFinished, needsAnswer, verdictsFrom, type ReflectionRow } from './reflections';
import { shapeOf, type TripRow } from './similarity';

const NOW = +new Date('2026-07-28T12:00:00');

const CAMPING = {
  tripTypes: ['Camping'],
  travelModes: ['Driving'],
  lodgings: ['Tent'],
  conditions: ['Cold nights'],
  attendees: [{ id: 'jared' }],
};

const uintas: TripRow = { ...CAMPING, id: 'uintas', name: 'Uintas', departAt: '2025-09-04' };
const backpacking: TripRow = {
  ...CAMPING,
  id: 'backpacking',
  name: 'Highline',
  lodgings: ['Backpacking'],
  travelModes: ['Driving'],
  departAt: '2025-08-01',
};
const conference: TripRow = {
  id: 'chicago',
  name: 'Chicago',
  tripTypes: ['Work'],
  travelModes: ['Flying'],
  lodgings: ['Hotel'],
  conditions: ['Formal dress'],
  departAt: '2025-06-01',
  attendees: [{ id: 'jared' }],
};

const current = shapeOf({ ...CAMPING, id: 'next', name: 'Next', departAt: '2026-09-04' }, NOW);

const ask = (reflections: ReflectionRow[], past: TripRow[] = [uintas]) =>
  verdictsFrom({ reflections, current, past, now: NOW });

describe('verdictsFrom', () => {
  /** The only input in the system that can name something no list has ever held. */
  it('promotes what someone said they wished they had', () => {
    const out = ask([{ kind: 'wished_had', name: 'Second lantern', trip: { id: 'uintas' } }]);
    expect(out.promoted).toEqual([{ name: 'Second lantern', sharing: 'one' }]);
  });

  it('promotes something that was on the list and got forgotten', () => {
    const out = ask([{ kind: 'forgot', item: { name: 'Headlamp' }, trip: { id: 'uintas' } }]);
    expect(out.promoted.map((s) => s.name)).toEqual(['Headlamp']);
  });

  it('demotes what came along and never got used', () => {
    const out = ask([{ kind: 'didnt_need', item: { name: 'Axe' }, trip: { id: 'uintas' } }]);
    expect(out.demoted).toEqual(['Axe']);
    expect(out.promoted).toEqual([]);
  });

  it('demotes a deliberate decision the same as an irrelevant one', () => {
    const out = ask([
      { kind: 'skipped', item: { name: 'Griddle' }, trip: { id: 'uintas' } },
      { kind: 'didnt_fit', item: { name: 'Cornhole' }, trip: { id: 'uintas' } },
    ]);
    expect(out.demoted.sort()).toEqual(['Cornhole', 'Griddle']);
  });

  /**
   * The most important entry in the table by its absence. "It went in the car, nobody ticked it"
   * is a fact about the checkbox — and it's probably the most common of the four answers, so
   * treating it as signal would drown everything the other three say.
   */
  it('learns nothing at all from a checkbox nobody ticked', () => {
    const out = ask([{ kind: 'mistracked', item: { name: 'Tent' }, trip: { id: 'uintas' } }]);
    expect(out).toEqual({ promoted: [], demoted: [] });
  });

  /**
   * The rule that makes reflections safe to act on. The note was true and the inference from it
   * would be wrong.
   */
  it('does not let a backpacking regret strip a car-camping list', () => {
    const notes: ReflectionRow[] = [
      { kind: 'didnt_need', item: { name: 'Camp chairs' }, trip: { id: 'backpacking' } },
    ];

    // A trip that IS backpacking hears it...
    const onFoot = verdictsFrom({
      reflections: notes,
      current: shapeOf({ ...CAMPING, id: 'next', lodgings: ['Backpacking'] }, NOW),
      past: [backpacking],
      now: NOW,
    });
    expect(onFoot.demoted).toEqual(['Camp chairs']);

    // ...a trip that isn't, doesn't.
    expect(ask(notes, [conference]).demoted).toEqual([]);
  });

  it('ignores a note from a trip nothing like this one', () => {
    const out = ask([{ kind: 'wished_had', name: 'Lanyard', trip: { id: 'chicago' } }], [conference]);
    expect(out.promoted).toEqual([]);
  });

  // Unscoped, a note would apply to every trip forever — which is the one thing the trip link
  // exists to prevent.
  it('ignores a note with no trip behind it', () => {
    expect(ask([{ kind: 'wished_had', name: 'Nothing in particular' }]).promoted).toEqual([]);
  });

  it('ranks a repeated regret above a one-off', () => {
    const out = ask(
      [
        { kind: 'wished_had', name: 'Firewood', trip: { id: 'backpacking' } },
        { kind: 'wished_had', name: 'Second lantern', trip: { id: 'uintas' } },
        { kind: 'wished_had', name: 'Second lantern', trip: { id: 'backpacking' } },
      ],
      [uintas, backpacking],
    );

    expect(out.promoted[0].name).toBe('Second lantern');
  });

  it('has nothing to say for a household that has never reflected', () => {
    expect(ask([])).toEqual({ promoted: [], demoted: [] });
  });
});

describe('needsAnswer', () => {
  /** The one question worth asking: everything else the app can answer for itself. */
  it('asks only about things that were never ticked', () => {
    const lists = [
      {
        items: [
          { id: '1', name: 'Tent', state: 'loaded' },
          { id: '2', name: 'Axe', state: 'unpacked' },
          { id: '3', name: 'Stove', state: 'packed' },
        ],
      },
    ];

    expect(needsAnswer(lists).map((i) => i.name)).toEqual(['Axe']);
  });

  it('treats an item with no state as never ticked', () => {
    expect(needsAnswer([{ items: [{ id: '1', name: 'Axe' }] }])).toHaveLength(1);
  });

  // A kit's own row is a container, and "did the box come" isn't a question about a thing.
  it('leaves kits out of it', () => {
    const lists = [
      {
        items: [
          { id: '1', name: 'Camp kitchen', state: 'unpacked', group: { id: 'g' } },
          { id: '2', name: 'Axe', state: 'unpacked' },
        ],
      },
    ];

    expect(needsAnswer(lists).map((i) => i.name)).toEqual(['Axe']);
  });

  it('has nothing to ask about a fully packed trip', () => {
    expect(needsAnswer([{ items: [{ id: '1', name: 'Tent', state: 'loaded' }] }])).toEqual([]);
  });
});

describe('isFinished', () => {
  it('is true once the return date has passed', () => {
    expect(isFinished({ returnAt: '2026-07-01' }, NOW)).toBe(true);
  });

  it('falls back to the departure date when there is no return', () => {
    expect(isFinished({ departAt: '2026-07-01' }, NOW)).toBe(true);
    expect(isFinished({ departAt: '2026-09-01' }, NOW)).toBe(false);
  });

  it('prefers the return date over the departure date', () => {
    expect(isFinished({ departAt: '2026-07-01', returnAt: '2026-08-01' }, NOW)).toBe(false);
  });

  /** Prompting about a trip that might not have happened is worse than never prompting. */
  it('gives up rather than guessing about an undated trip', () => {
    expect(isFinished({}, NOW)).toBe(false);
  });
});
