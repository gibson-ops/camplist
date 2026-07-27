/**
 * These assert the SHAPE of what gets written, not that InstantDB works.
 *
 * The shapes are load-bearing and invisible at the call site: a kit's contents must link to
 * their parent and never to a list, or forty kitchen utensils spill onto the trip screen; a
 * trip must arrive with lists already on it, or a new trip asks the user to make an
 * organizational decision before they can write down "sleeping bag". Both are the kind of
 * thing a well-meaning refactor "tidies" away.
 */

// lib/db throws at import time without EXPO_PUBLIC_INSTANT_APP_ID, and would open a real
// socket if it didn't. The mock records transactions instead of sending them.
const transacts: unknown[][] = [];

jest.mock('./db', () => {
  /** Mirrors Instant's chainable proxy: tx.<entity>[<id>].update({}).link({}) */
  const makeChunk = (entity: string, entityId: string) => {
    const ops: Record<string, unknown>[] = [];
    const chunk = {
      entity,
      id: entityId,
      ops,
      update(attrs: Record<string, unknown>) {
        ops.push({ op: 'update', attrs });
        return chunk;
      },
      link(links: Record<string, unknown>) {
        ops.push({ op: 'link', links });
        return chunk;
      },
      delete() {
        ops.push({ op: 'delete' });
        return chunk;
      },
    };
    return chunk;
  };

  const tx = new Proxy(
    {},
    {
      get: (_t, entity: string) =>
        new Proxy({}, { get: (_e, entityId: string) => makeChunk(entity, entityId) }),
    },
  );

  let counter = 0;
  return {
    id: () => `id-${++counter}`,
    db: {
      tx,
      transact: (steps: unknown) => {
        transacts.push(Array.isArray(steps) ? steps : [steps]);
        return Promise.resolve({ 'tx-id': 1 });
      },
    },
  };
});

import {
  addItem,
  addKit,
  addKitContent,
  advanceItem,
  createTrip,
  deleteTrip,
  nextState,
  setListExpanded,
} from './trips';

type Chunk = {
  entity: string;
  id: string;
  ops: { op: string; attrs?: Record<string, unknown>; links?: Record<string, unknown> }[];
};

/** The steps recorded by the most recent transact(). */
const lastTx = () => transacts[transacts.length - 1] as unknown as Chunk[];
const attrsOf = (c: Chunk) => Object.assign({}, ...c.ops.filter((o) => o.attrs).map((o) => o.attrs));
const linksOf = (c: Chunk) => Object.assign({}, ...c.ops.filter((o) => o.links).map((o) => o.links));

beforeEach(() => {
  transacts.length = 0;
});

describe('nextState', () => {
  it('advances unpacked to packed to loaded', () => {
    expect(nextState('unpacked')).toBe('packed');
    expect(nextState('packed')).toBe('loaded');
  });

  // Things genuinely come back out of the car. Dead-ending at `loaded` would need a separate
  // undo affordance on every row, which costs more than the occasional extra tap.
  it('wraps from loaded back to unpacked', () => {
    expect(nextState('loaded')).toBe('unpacked');
  });

  it('recovers from an unrecognised state rather than sticking', () => {
    expect(nextState('nonsense' as never)).toBe('packed');
  });
});

describe('advanceItem', () => {
  it('writes only the next state', () => {
    advanceItem('item-1', 'packed');
    const [chunk] = lastTx();
    expect(chunk.entity).toBe('items');
    expect(chunk.id).toBe('item-1');
    expect(attrsOf(chunk)).toEqual({ state: 'loaded' });
  });
});

describe('createTrip', () => {
  const people = [
    { id: 'p-jared', name: 'Jared' },
    { id: 'p-walker', name: 'Walker' },
  ];

  it('seeds a shared list plus one per person', async () => {
    await createTrip({ householdId: 'hh-1', name: 'Uintas', people });
    const lists = lastTx().filter((c) => c.entity === 'lists');

    expect(lists).toHaveLength(3);
    expect(lists.map((l) => attrsOf(l).name)).toEqual(['Shared', 'Jared', 'Walker']);
  });

  // Shared sorts first because it holds the expensive, easy-to-forget things (tent, stove)
  // that ruin a trip in a way a forgotten toothbrush does not.
  it('sorts the shared list above the personal ones', async () => {
    await createTrip({ householdId: 'hh-1', name: 'Uintas', people });
    const lists = lastTx().filter((c) => c.entity === 'lists');
    expect(lists.map((l) => attrsOf(l).sortOrder)).toEqual([0, 1, 2]);
  });

  it('leaves the shared list unowned and gives each personal list its owner', async () => {
    await createTrip({ householdId: 'hh-1', name: 'Uintas', people });
    const [shared, jared, walker] = lastTx().filter((c) => c.entity === 'lists');

    expect(linksOf(shared).owner).toBeUndefined();
    expect(linksOf(jared).owner).toBe('p-jared');
    expect(linksOf(walker).owner).toBe('p-walker');
  });

  it('stamps householdId on every record for the permission rules', async () => {
    await createTrip({ householdId: 'hh-1', name: 'Uintas', people });
    for (const chunk of lastTx()) {
      expect(attrsOf(chunk).householdId).toBe('hh-1');
    }
  });

  it('creates a planning trip, never a template', async () => {
    await createTrip({ householdId: 'hh-1', name: 'Uintas', people });
    const trip = lastTx().find((c) => c.entity === 'trips')!;
    expect(attrsOf(trip)).toMatchObject({ name: 'Uintas', status: 'planning', isTemplate: false });
  });

  it('still produces a usable trip for a one-person household', async () => {
    await createTrip({ householdId: 'hh-1', name: 'Solo', people: [] });
    expect(lastTx().filter((c) => c.entity === 'lists')).toHaveLength(1);
  });
});

describe('addItem', () => {
  // `sharing` only means anything on the shared list. One cooler covers everybody, so 'one'
  // is right there; on a personal list the value is inert and 'each' is literally true.
  it('defaults to one-for-all on the shared list', () => {
    addItem({ listId: 'l-1', householdId: 'hh-1', name: 'Cooler', shared: true, sortOrder: 0 });
    expect(attrsOf(lastTx()[0]).sharing).toBe('one');
  });

  it('defaults to each on a personal list', () => {
    addItem({ listId: 'l-2', householdId: 'hh-1', name: 'Boots', shared: false, sortOrder: 0 });
    expect(attrsOf(lastTx()[0]).sharing).toBe('each');
  });

  it('starts unpacked and links to its list', () => {
    addItem({ listId: 'l-1', householdId: 'hh-1', name: 'Tent', shared: true, sortOrder: 3 });
    const [item] = lastTx();
    expect(attrsOf(item)).toMatchObject({ name: 'Tent', state: 'unpacked', qty: 1, sortOrder: 3 });
    expect(linksOf(item)).toEqual({ list: 'l-1' });
  });
});

describe('addKit', () => {
  it('creates the reusable template and the item that sits on the list', () => {
    addKit({ listId: 'l-1', householdId: 'hh-1', name: 'Kitchen box', sortOrder: 4 });
    const steps = lastTx();

    const group = steps.find((c) => c.entity === 'itemGroups')!;
    const item = steps.find((c) => c.entity === 'items')!;
    expect(attrsOf(group).name).toBe('Kitchen box');
    expect(linksOf(item)).toEqual({ list: 'l-1', group: group.id });
  });

  it('makes the kit packable like any other item', () => {
    addKit({ listId: 'l-1', householdId: 'hh-1', name: 'Kitchen box', sortOrder: 0 });
    const item = lastTx().find((c) => c.entity === 'items')!;
    expect(attrsOf(item).state).toBe('unpacked');
  });
});

describe('addKitContent', () => {
  // THE load-bearing one. Contents belong to the box, not to the list; linking them to a list
  // would spill every utensil onto the trip screen as a top-level row.
  it('links to the parent item and NEVER to a list', () => {
    addKitContent({
      parentId: 'item-kit',
      householdId: 'hh-1',
      name: 'Propane',
      consumable: true,
      sortOrder: 0,
    });
    const links = linksOf(lastTx()[0]);
    expect(links).toEqual({ parent: 'item-kit' });
    expect(links.list).toBeUndefined();
  });

  it('carries the consumable flag through, since that is what gates the parent', () => {
    addKitContent({ parentId: 'k', householdId: 'hh-1', name: 'Propane', consumable: true, sortOrder: 0 });
    expect(attrsOf(lastTx()[0]).consumable).toBe(true);

    addKitContent({ parentId: 'k', householdId: 'hh-1', name: 'Skillet', consumable: false, sortOrder: 1 });
    expect(attrsOf(lastTx()[0]).consumable).toBe(false);
  });
});

describe('deleteTrip', () => {
  // Kit contents link to their parent, not to the list, so deleting the list's items alone
  // leaves them behind as unreachable rows.
  it('reaches into kits so no contents are orphaned', () => {
    deleteTrip('trip-1', [
      {
        id: 'l-1',
        items: [
          { id: 'i-1' },
          { id: 'i-kit', children: [{ id: 'c-1' }, { id: 'c-2' }] },
        ],
      },
    ]);

    const deleted = lastTx().map((c) => c.id);
    expect(deleted).toEqual(['c-1', 'c-2', 'i-1', 'i-kit', 'l-1', 'trip-1']);
  });

  it('deletes children before their parents', () => {
    deleteTrip('trip-1', [{ id: 'l-1', items: [{ id: 'i-kit', children: [{ id: 'c-1' }] }] }]);
    const ids = lastTx().map((c) => c.id);
    expect(ids.indexOf('c-1')).toBeLessThan(ids.indexOf('i-kit'));
    expect(ids.indexOf('i-kit')).toBeLessThan(ids.indexOf('l-1'));
  });

  it('handles a trip whose lists are empty', () => {
    deleteTrip('trip-1', [{ id: 'l-1' }]);
    expect(lastTx().map((c) => c.id)).toEqual(['l-1', 'trip-1']);
  });

  // A kit is a reusable template that outlives any one trip.
  it('leaves itemGroups alone', () => {
    deleteTrip('trip-1', [{ id: 'l-1', items: [{ id: 'i-kit' }] }]);
    expect(lastTx().some((c) => c.entity === 'itemGroups')).toBe(false);
  });
});

describe('setListExpanded', () => {
  it('writes the merged prefs onto the profile', () => {
    setListExpanded({
      profileId: 'prof-1',
      prefs: { 'l-other': true },
      listId: 'l-mine',
      expanded: false,
      ownerPersonId: 'p-jared',
      myPersonId: 'p-jared',
    });

    const [chunk] = lastTx();
    expect(chunk.entity).toBe('profiles');
    expect(attrsOf(chunk).listPrefs).toEqual({ 'l-other': true, 'l-mine': false });
  });

  it('clears the key when the toggle lands back on the default', () => {
    setListExpanded({
      profileId: 'prof-1',
      prefs: { 'l-mine': false },
      listId: 'l-mine',
      expanded: true,
      ownerPersonId: 'p-jared',
      myPersonId: 'p-jared',
    });
    expect(attrsOf(lastTx()[0]).listPrefs).toEqual({});
  });
});
