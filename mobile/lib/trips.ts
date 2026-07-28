import { db, id } from './db';
import { planAttendees, type TripList } from './attendees';
import { withExpanded, type ListPrefs } from './listPrefs';
import type { MergePlan, StrandedHousehold } from './merge';

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
 * Seeds one shared list plus one list per ATTENDEE, because an empty trip with no structure
 * asks the user to make an organizational decision before they can write down "sleeping bag".
 * The shared list sorts first: it holds the expensive, easy-to-forget things (tent, stove)
 * that ruin a trip in a way a forgotten toothbrush does not.
 *
 * Attendees are also linked as trip metadata, not just turned into lists. Who went is one of
 * the axes past trips get matched on, and it would be lost the moment someone's empty list got
 * tidied away.
 *
 * @param attendees the people going, in the order their lists should appear
 * @returns the new trip's id, so the caller can navigate straight into it
 */
export function createTrip({
  householdId,
  name,
  attendees,
}: {
  householdId: string;
  name: string;
  attendees: { id: string; name: string }[];
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
      .link(
        attendees.length
          ? { household: householdId, attendees: attendees.map((p) => p.id) }
          : { household: householdId },
      ),

    db.tx.lists[id()]
      .update({ name: 'Shared', kind: 'outbound', sortOrder: 0, householdId, createdAt: now })
      .link({ trip: tripId }),

    ...attendees.map((person, i) =>
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
 * Everything a trip can say about itself, all optional.
 *
 * Cleared text is stored as `''` rather than removed, so there is exactly one falsy
 * representation of "not filled in" for `metadataCompleteness` to read. Dates get `null`,
 * because an empty string is not a date and the attribute is indexed.
 */
export type TripMetaPatch = {
  name?: string;
  destination?: string;
  notes?: string;
  departAt?: Date | null;
  returnAt?: Date | null;
  /** Every axis is a list; the singular fields are deprecated and never written. */
  tripTypes?: string[];
  travelModes?: string[];
  lodgings?: string[];
  activities?: string[];
  conditions?: string[];
};

export function updateTrip(tripId: string, patch: TripMetaPatch) {
  return db.transact(db.tx.trips[tripId].update(patch));
}

/**
 * Moves a trip's attendance to exactly `next`, keeping per-person lists in step.
 *
 * The interesting rules live in `planAttendees` — most of all, that removing someone deletes
 * their list only when it's empty. This function is the transaction that carries the plan out.
 *
 * @param lists every list on the trip, each with how many items are on it
 * @param names person id → display name, used to title any list this creates
 */
export function setTripAttendees({
  tripId,
  householdId,
  current,
  next,
  lists,
  names,
}: {
  tripId: string;
  householdId: string;
  current: string[];
  next: string[];
  lists: TripList[];
  names: Map<string, string>;
}) {
  const plan = planAttendees({ current, next, lists });
  const now = new Date();
  // New lists land after whatever is already there. The shared list keeps sortOrder 0.
  let order = lists.length;

  const tx = [
    ...(plan.link.length ? [db.tx.trips[tripId].link({ attendees: plan.link })] : []),
    ...(plan.unlink.length ? [db.tx.trips[tripId].unlink({ attendees: plan.unlink })] : []),

    ...plan.addListFor.map((personId) =>
      db.tx.lists[id()]
        .update({
          name: names.get(personId) ?? 'Someone',
          kind: 'outbound',
          sortOrder: order++,
          householdId,
          createdAt: now,
        })
        .link({ trip: tripId, owner: personId }),
    ),

    ...plan.removeLists.map((listId) => db.tx.lists[listId].delete()),
  ];

  return tx.length ? db.transact(tx) : Promise.resolve();
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

/**
 * Puts a suggested item on a list.
 *
 * Distinct from `addItem` only in that `sharing` comes from the seed rather than from which
 * list it landed on: "everyone brings their own towel" is one row on the shared list, not one
 * row per person, which is exactly what `items.sharing` was for.
 */
export function addSuggestedItem({
  listId,
  householdId,
  name,
  sharing,
  consumable = false,
  sortOrder,
}: {
  listId: string;
  householdId: string;
  name: string;
  sharing: 'one' | 'each';
  consumable?: boolean;
  sortOrder: number;
}) {
  return db.transact(
    db.tx.items[id()]
      .update({
        name,
        qty: 1,
        consumable,
        state: 'unpacked',
        sharing,
        sortOrder,
        householdId,
        createdAt: new Date(),
      })
      .link({ list: listId }),
  );
}

/**
 * Puts a reviewed set of suggestions on a list in one write.
 *
 * One transaction rather than one per item: the review screen is a single decision the user
 * already made, and twelve separate writes would be twelve chances for half of them to land.
 */
export function addSuggestedItems({
  householdId,
  planned,
  startOrder = 0,
}: {
  householdId: string;
  planned: {
    listId: string;
    seed: { name: string; sharing?: 'one' | 'each'; consumable?: boolean };
  }[];
  startOrder?: number;
}) {
  if (!planned.length) return Promise.resolve();
  const now = new Date();
  const nextOrder = new Map<string, number>();

  return db.transact(
    planned.map(({ listId, seed }) => {
      const order = nextOrder.get(listId) ?? startOrder;
      nextOrder.set(listId, order + 1);

      return db.tx.items[id()]
        .update({
          name: seed.name,
          qty: 1,
          consumable: seed.consumable ?? false,
          state: 'unpacked',
          // Inert once an item is on a personal list, and 'each' is literally true of it there.
          sharing: seed.sharing ?? 'one',
          sortOrder: order,
          householdId,
          createdAt: now,
        })
        .link({ list: listId });
    }),
  );
}

/**
 * Records that a suggestion was turned down.
 *
 * Written as a `dismissed` reflection rather than hidden in a preference blob, because it IS a
 * reflection: the household telling the app something about itself. Doing it once silences the
 * suggestion on this trip; doing it on a second trip silences it everywhere (see
 * `dismissedNames`) — an observation rather than a setting nobody wants to maintain.
 *
 * `name` carries it because there is no item to link to. That's the whole reason the field
 * exists; see instant.schema.ts.
 */
export function dismissSuggestion({
  tripId,
  householdId,
  name,
}: {
  tripId: string;
  householdId: string;
  name: string;
}) {
  return db.transact(
    db.tx.reflections[id()]
      .update({ kind: 'dismissed', name, resolved: false, householdId, createdAt: new Date() })
      .link({ trip: tripId }),
  );
}

/**
 * Records what happened on a trip, in one write.
 *
 * One transaction because it's one sitting: the user answered a screenful of questions and
 * pressed done, and half of it landing would leave the app having asked for nothing.
 *
 * `mistracked` answers are dropped on the floor rather than stored. They're a fact about the
 * checkbox, not the item — see the VERDICT table in lib/reflections.ts — and writing rows the
 * engine is required to ignore is how a table fills with noise nobody can later tell apart from
 * signal.
 *
 * @param answers one per never-packed item: what actually happened to it
 * @param wished things nobody had, named freely; the only input that can add something no list
 *               has ever held
 */
export function recordReflections({
  tripId,
  householdId,
  answers,
  wished,
}: {
  tripId: string;
  householdId: string;
  answers: { itemId: string; kind: string }[];
  wished: string[];
}) {
  const now = new Date();
  const tx = [
    ...answers
      .filter((answer) => answer.kind !== 'mistracked')
      .map((answer) =>
        db.tx.reflections[id()]
          .update({ kind: answer.kind, resolved: false, householdId, createdAt: now })
          .link({ trip: tripId, item: answer.itemId }),
      ),

    ...wished
      .map((name) => name.trim())
      .filter(Boolean)
      // No item to link to, which is the whole reason `reflections.name` exists.
      .map((name) =>
        db.tx.reflections[id()]
          .update({ kind: 'wished_had', name, resolved: false, householdId, createdAt: now })
          .link({ trip: tripId }),
      ),
  ];

  return tx.length ? db.transact(tx) : Promise.resolve();
}

/**
 * Notes that a household was left behind on this device, so the offer to merge it survives.
 *
 * Deliberately additive and deduplicated: someone can strand a household on their phone AND on
 * their laptop, and finishing one must not forget the other.
 */
export function addPendingMerge({
  profileId,
  pending,
  stranded,
}: {
  profileId: string;
  pending: StrandedHousehold[];
  stranded: StrandedHousehold;
}) {
  if (pending.some((entry) => entry.household === stranded.household)) return Promise.resolve();
  return db.transact(db.tx.profiles[profileId].update({ pendingMerge: [...pending, stranded] }));
}

/**
 * Carries out a merge plan: everything a guest made becomes part of the signed-in household.
 *
 * ONE TRANSACTION, and that isn't an optimization. A half-applied merge is the worst state this
 * data can be in — some rows re-stamped and visible, others left behind and unreachable, one
 * trip's items split across two households with no way for the user to tell which. Atomicity is
 * the only thing that makes the operation safe to retry after a dropped connection.
 *
 * `pendingMerge` is cleared in the same transaction, so the offer can't reappear for a household
 * that's already been drained, and can't disappear for one that hasn't.
 *
 * @param plan what to move; see `planMerge`
 * @param into the household id everything becomes part of
 */
export function mergeHousehold({
  plan,
  from,
  into,
  profileId,
  pending,
}: {
  plan: MergePlan;
  from: string;
  into: string;
  profileId: string;
  pending: StrandedHousehold[];
}) {
  const tx = [
    // The denormalized stamp the permission rules actually read. Miss one and it's unreachable.
    ...plan.restamp.flatMap((group) =>
      group.ids.map((rowId) => db.tx[group.entity][rowId].update({ householdId: into })),
    ),

    // The real links, for the three entities that carry one.
    //
    // LINK WITHOUT UNLINKING. Each of these is a has-one, so linking the new household replaces
    // the old one on its own — and unlinking explicitly is a write against the household being
    // left behind, which the signed-in user is not a member of. That failed the whole transaction
    // with "not perms-pass" and moved nothing.
    ...plan.relink.flatMap((group) =>
      group.ids.map((rowId) => db.tx[group.entity][rowId].link({ household: into })),
    ),

    // The guest's own person folds into the person who already exists, so anything that pointed
    // at them has to point somewhere real before they're deleted.
    ...(plan.absorbPerson
      ? [
          ...plan.reownLists.map((listId) =>
            db.tx.lists[listId]
              .unlink({ owner: plan.absorbPerson!.from })
              .link({ owner: plan.absorbPerson!.to }),
          ),
          ...plan.reattributeReflections.map((noteId) =>
            db.tx.reflections[noteId]
              .unlink({ person: plan.absorbPerson!.from })
              .link({ person: plan.absorbPerson!.to }),
          ),
          db.tx.people[plan.absorbPerson.from].delete(),
        ]
      : []),

    db.tx.profiles[profileId].update({
      pendingMerge: pending.filter((entry) => entry.household !== from),
    }),
  ];

  return db.transact(tx);
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

/**
 * Renames the household. Worth having its own name because invitations will quote it: "Jared
 * invited you to My household" reads like a bug.
 */
export function renameHousehold(householdId: string, name: string) {
  return db.transact(db.tx.households[householdId].update({ name }));
}

/** Records that first-run onboarding is done, so no device asks again. */
export function finishOnboarding(profileId: string) {
  return db.transact(db.tx.profiles[profileId].update({ onboardedAt: new Date() }));
}

export function renamePerson(personId: string, name: string) {
  return db.transact(db.tx.people[personId].update({ name }));
}

/**
 * Brings one person onto a trip: attendee link and a list, together.
 *
 * Both halves, always. Giving someone a list without recording that they went would leave the
 * trip describing itself wrongly to the suggestion engine — and "who was on it" is one of the
 * few signals strong enough to matter.
 */
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
  return db.transact([
    db.tx.trips[tripId].link({ attendees: [person.id] }),
    db.tx.lists[id()]
      .update({
        name: person.name,
        kind: 'outbound',
        sortOrder,
        householdId,
        createdAt: new Date(),
      })
      .link({ trip: tripId, owner: person.id }),
  ]);
}
