import { db, id } from './db';
import { withExpanded, type ListPrefs } from './listPrefs';

/**
 * Every write the trip screens make. Screens call these; they never build a transaction
 * inline, so the shape of a valid trip lives in one file.
 *
 * All of these are plain local writes. InstantDB applies them optimistically and syncs when
 * it can, which is why nothing here is async-aware or has a retry: being offline is the
 * normal case, not an error path.
 */

/**
 * Packing progress. Structurally identical to the design system's `PackState` on purpose —
 * this one mirrors `items.state` in the schema, that one describes what StateBox can render,
 * and neither layer should have to import the other.
 */
export type PackState = 'unpacked' | 'packed' | 'loaded';

/**
 * Tapping advances, and wraps at the end.
 *
 * Wrapping rather than dead-ending at `loaded` because the correction case is real: things
 * come back OUT of the car. A separate "undo" affordance on every row would cost more than
 * the occasional extra tap of cycling around.
 */
const NEXT: Record<PackState, PackState> = {
  unpacked: 'packed',
  packed: 'loaded',
  loaded: 'unpacked',
};

export function nextState(state: PackState): PackState {
  return NEXT[state] ?? 'packed';
}

/** Advance one item (or one kit's child) to its next packing state. */
export function advanceItem(itemId: string, current: PackState) {
  return db.transact(db.tx.items[itemId].update({ state: nextState(current) }));
}

/**
 * Creates a trip and the lists it needs to be usable immediately.
 *
 * Seeds one shared list plus one list per person, because an empty trip with no structure
 * asks the user to make an organizational decision before they can write down "sleeping bag".
 * The shared list sorts first: it holds the expensive, easy-to-forget things (tent, stove)
 * that ruin a trip in a way a forgotten toothbrush does not.
 *
 * @param people household people, in the order their lists should appear
 * @returns the new trip's id, so the caller can navigate straight into it
 */
export function createTrip({
  householdId,
  name,
  people,
}: {
  householdId: string;
  name: string;
  people: { id: string; name: string }[];
}) {
  const now = new Date();
  const tripId = id();

  const tx = [
    db.tx.trips[tripId]
      .update({
        name,
        status: 'planning',
        isTemplate: false,
        householdId,
        createdAt: now,
      })
      .link({ household: householdId }),

    db.tx.lists[id()]
      .update({ name: 'Shared', kind: 'outbound', sortOrder: 0, householdId, createdAt: now })
      .link({ trip: tripId }),

    ...people.map((person, i) =>
      db.tx.lists[id()]
        .update({
          name: person.name,
          kind: 'outbound',
          sortOrder: i + 1,
          householdId,
          createdAt: now,
        })
        .link({ trip: tripId, owner: person.id }),
    ),
  ];

  return db.transact(tx).then(() => tripId);
}

export function renameTrip(tripId: string, name: string) {
  return db.transact(db.tx.trips[tripId].update({ name }));
}

/**
 * Removes the trip and everything hanging off it.
 *
 * Walks into kit contents explicitly: children link to their parent item and not to the list,
 * so deleting the list's items alone would leave them behind as unreachable rows.
 *
 * `itemGroups` survive on purpose — a kit is a reusable template that outlives any one trip.
 */
export function deleteTrip(
  tripId: string,
  lists: { id: string; items?: { id: string; children?: { id: string }[] }[] }[],
) {
  const items = lists.flatMap((l) => l.items ?? []);
  const children = items.flatMap((item) => item.children ?? []);

  return db.transact([
    ...children.map((c) => db.tx.items[c.id].delete()),
    ...items.map((item) => db.tx.items[item.id].delete()),
    ...lists.map((l) => db.tx.lists[l.id].delete()),
    db.tx.trips[tripId].delete(),
  ]);
}

/**
 * Adds a plain item to a list.
 *
 * @param shared true when the destination is the shared list, which is the only place
 *               `sharing` means anything. One cooler covers everybody, so 'one' is the right
 *               default there; on a personal list the value is inert and 'each' is literally
 *               true of it.
 * @param sortOrder caller passes max+1; ordering is resolved client-side (see useTrip)
 */
export function addItem({
  listId,
  householdId,
  name,
  shared,
  sortOrder,
}: {
  listId: string;
  householdId: string;
  name: string;
  shared: boolean;
  sortOrder: number;
}) {
  return db.transact(
    db.tx.items[id()]
      .update({
        name,
        qty: 1,
        consumable: false,
        state: 'unpacked',
        sharing: shared ? 'one' : 'each',
        sortOrder,
        householdId,
        createdAt: new Date(),
      })
      .link({ list: listId }),
  );
}

/**
 * Adds a kit (the camp kitchen box) to a list.
 *
 * Creates two records: the reusable `itemGroups` template, and the `items` row that
 * represents the box sitting on THIS list. That split is what makes a kit reusable — the
 * template outlives the trip, the item doesn't.
 *
 * Contents start empty and get added per-trip via `addKitContent`. Promoting this trip's
 * contents back into the template (`groupItems`) is the learning loop, and is deliberately
 * not automatic: one trip where you left the skillet home shouldn't rewrite the box.
 */
export function addKit({
  listId,
  householdId,
  name,
  sortOrder,
}: {
  listId: string;
  householdId: string;
  name: string;
  sortOrder: number;
}) {
  const now = new Date();
  const groupId = id();

  return db.transact([
    db.tx.itemGroups[groupId]
      .update({ name, householdId, createdAt: now })
      .link({ household: householdId }),

    db.tx.items[id()]
      .update({
        name,
        qty: 1,
        consumable: false,
        state: 'unpacked',
        sharing: 'one',
        sortOrder,
        householdId,
        createdAt: now,
      })
      .link({ list: listId, group: groupId }),
  ]);
}

/**
 * Adds one thing inside a kit.
 *
 * Linked to `parent` and deliberately NOT to `list`: a kit's contents belong to the box, not
 * to the list, which is what keeps `list.items` a clean set of top-level rows instead of
 * spilling forty kitchen utensils onto the trip screen.
 *
 * @param consumable the whole reason kits gate: propane can be empty, a skillet cannot
 */
export function addKitContent({
  parentId,
  householdId,
  name,
  consumable,
  sortOrder,
}: {
  parentId: string;
  householdId: string;
  name: string;
  consumable: boolean;
  sortOrder: number;
}) {
  return db.transact(
    db.tx.items[id()]
      .update({
        name,
        qty: 1,
        consumable,
        state: 'unpacked',
        sharing: 'one',
        sortOrder,
        householdId,
        createdAt: new Date(),
      })
      .link({ parent: parentId }),
  );
}

/** Removes an item and, if it's a kit, everything inside it. */
export function deleteItem(itemId: string, childIds: string[] = []) {
  return db.transact([
    ...childIds.map((c) => db.tx.items[c].delete()),
    db.tx.items[itemId].delete(),
  ]);
}

export function updateItem(
  itemId: string,
  patch: { name?: string; note?: string; qty?: number; consumable?: boolean; sharing?: string },
) {
  return db.transact(db.tx.items[itemId].update(patch));
}

/** Persists a list's open/closed state onto the profile. See listPrefs.ts for the rules. */
export function setListExpanded({
  profileId,
  prefs,
  listId,
  expanded,
  ownerPersonId,
  myPersonId,
}: {
  profileId: string;
  prefs: ListPrefs;
  listId: string;
  expanded: boolean;
  ownerPersonId?: string;
  myPersonId?: string;
}) {
  const next = withExpanded(prefs, listId, expanded, ownerPersonId, myPersonId);
  return db.transact(db.tx.profiles[profileId].update({ listPrefs: next }));
}

/**
 * Adds someone to the household.
 *
 * People are not logins: Walker gets a list without ever getting an account. Adding a person
 * does NOT retroactively give them lists on existing trips — those were seeded when the trip
 * was created, and silently mutating a trip you already packed would be worse than the gap.
 */
export function addPerson({ householdId, name }: { householdId: string; name: string }) {
  return db.transact(
    db.tx.people[id()]
      .update({ name, householdId, createdAt: new Date() })
      .link({ household: householdId }),
  );
}

export function renamePerson(personId: string, name: string) {
  return db.transact(db.tx.people[personId].update({ name }));
}

/** Adds a list for one person to a trip that predates them. */
export function addListForPerson({
  tripId,
  householdId,
  person,
  sortOrder,
}: {
  tripId: string;
  householdId: string;
  person: { id: string; name: string };
  sortOrder: number;
}) {
  return db.transact(
    db.tx.lists[id()]
      .update({
        name: person.name,
        kind: 'outbound',
        sortOrder,
        householdId,
        createdAt: new Date(),
      })
      .link({ trip: tripId, owner: person.id }),
  );
}
