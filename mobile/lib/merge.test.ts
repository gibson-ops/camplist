import {
  describeMerge,
  parsePending,
  planMerge,
  strandedElsewhere,
  type GuestHousehold,
} from './merge';

const EMPTY: GuestHousehold = {
  id: 'guest-household',
  people: [],
  trips: [],
  lists: [],
  items: [],
  itemGroups: [],
  groupItems: [],
  reflections: [],
};

/** A guest who packed one trip before signing in: their own person, a shared list and a personal one. */
const GUEST: GuestHousehold = {
  ...EMPTY,
  people: [
    { id: 'guest-me', name: 'Me', profileId: 'guest-profile' },
    { id: 'guest-brooke', name: 'Brooke' },
  ],
  trips: [{ id: 'trip-1', name: 'Mirror Lake' }],
  lists: [
    { id: 'list-shared' },
    { id: 'list-mine', ownerId: 'guest-me' },
    { id: 'list-brooke', ownerId: 'guest-brooke' },
  ],
  items: [{ id: 'item-1' }, { id: 'item-2' }],
  itemGroups: [{ id: 'kit-1' }],
  groupItems: [{ id: 'group-item-1' }],
  reflections: [{ id: 'note-1', personId: 'guest-me' }, { id: 'note-2' }],
};

// Spread rather than default parameters: `plan(GUEST, undefined)` would take the default back,
// which is exactly the case the no-person-to-fold-into test is trying to exercise.
const plan = (over: Partial<Parameters<typeof planMerge>[0]> = {}) =>
  planMerge({ guest: GUEST, selfPersonId: 'account-me', ...over });

const restampedIds = (entity: string, p = plan()) =>
  p?.restamp.find((group) => group.entity === entity)?.ids ?? [];

describe('planMerge', () => {
  /**
   * The silent one. Permissions key on the denormalized `householdId` string, not on the links,
   * so a row that keeps the old value doesn't move — it becomes unreachable by everyone,
   * including the person who just asked for it to be moved.
   */
  it('re-stamps every kind of row the household owns', () => {
    const p = plan();
    const covered = new Set(p?.restamp.map((group) => group.entity));

    expect(covered).toEqual(
      new Set(['people', 'trips', 'lists', 'items', 'itemGroups', 'groupItems', 'reflections']),
    );
  });

  it('re-links the rows that carry a real household link, not just the stamp', () => {
    const entities = plan()?.relink.map((group) => group.entity);
    expect(new Set(entities)).toEqual(new Set(['people', 'trips', 'itemGroups']));
  });

  /**
   * The guest's own person is the same human as the signed-in user's. Copying it would put "Me"
   * on the household twice with the trips split between them.
   */
  it('folds the guest into the person who already exists rather than copying them', () => {
    const p = plan();
    expect(p?.absorbPerson).toEqual({ from: 'guest-me', to: 'account-me' });
    expect(restampedIds('people')).toEqual(['guest-brooke']);
  });

  it('hands the absorbed person’s list and notes to the person who takes their place', () => {
    const p = plan();
    expect(p?.reownLists).toEqual(['list-mine']);
    expect(p?.reattributeReflections).toEqual(['note-1']);
  });

  /**
   * The profile link is unreadable exactly when it's needed: `profiles.view` is
   * `isSelf || sharesHousehold`, and a linked guest's profile is neither. Caught by running the
   * merge for real — it offered to move a second "Me" into a household that already had one.
   */
  it('uses the recorded id when the guest profile can’t be read', () => {
    const unreadable: GuestHousehold = {
      ...GUEST,
      people: [
        { id: 'guest-me', name: 'Me' },
        { id: 'guest-brooke', name: 'Brooke' },
      ],
    };

    const p = plan({ guest: unreadable, guestSelfPersonId: 'guest-me' });
    expect(p?.absorbPerson).toEqual({ from: 'guest-me', to: 'account-me' });
    expect(p?.summary.people).toBe(1);
  });

  it('leaves the duplicate behind when nothing identifies the guest', () => {
    const unreadable: GuestHousehold = { ...GUEST, people: [{ id: 'guest-me', name: 'Me' }] };
    // No recorded id and no readable profile: moving an extra person is wrong but visible, where
    // guessing by name could hand one person's list to another.
    expect(plan({ guest: unreadable })?.absorbPerson).toBeUndefined();
  });

  /**
   * Identified by the profile link, never by the name. A name is a label anybody can type; the
   * link is the fact.
   */
  it('finds the guest’s own person by their profile, not by being called Me', () => {
    const oddlyNamed: GuestHousehold = {
      ...GUEST,
      people: [
        { id: 'guest-me', name: 'Dad', profileId: 'guest-profile' },
        { id: 'decoy', name: 'Me' },
      ],
    };

    expect(plan({ guest: oddlyNamed })?.absorbPerson?.from).toBe('guest-me');
  });

  /**
   * Two "Brooke" rows are visible and take one tap to sort out. Silently pooling the lists of two
   * people who happen to share a name is not recoverable, and nothing anywhere says they're the
   * same human.
   */
  it('never matches people by name', () => {
    expect(restampedIds('people')).toContain('guest-brooke');
    expect(plan()?.absorbPerson?.from).not.toBe('guest-brooke');
  });

  it('moves everything as-is when the account has no person to fold into', () => {
    const p = plan({ selfPersonId: undefined });
    expect(p?.absorbPerson).toBeUndefined();
    expect(restampedIds('people', p)).toEqual(['guest-me', 'guest-brooke']);
    expect(p?.reownLists).toEqual([]);
  });

  it('counts what will actually appear, so the total matches the screen afterwards', () => {
    expect(plan()?.summary).toEqual({ trips: 1, people: 1, items: 2, kits: 1 });
  });

  it('has no plan for a guest who never made anything', () => {
    expect(plan({ guest: EMPTY })).toBeUndefined();
  });

  it('still has a plan for a guest with data but no trips', () => {
    const notesOnly: GuestHousehold = { ...EMPTY, itemGroups: [{ id: 'kit-1' }] };
    expect(plan({ guest: notesOnly })).toBeDefined();
  });
});

describe('describeMerge', () => {
  it('says exactly what is about to move', () => {
    expect(describeMerge({ trips: 2, people: 1, items: 14, kits: 1 })).toBe(
      'Move 2 trips, 1 person, 14 items and 1 kit',
    );
  });

  it('drops the parts with nothing in them', () => {
    expect(describeMerge({ trips: 1, people: 0, items: 6, kits: 0 })).toBe(
      'Move 1 trip and 6 items',
    );
  });

  it('reads as a sentence with only one part', () => {
    expect(describeMerge({ trips: 3, people: 0, items: 0, kits: 0 })).toBe('Move 3 trips');
  });

  it('says so when there is nothing', () => {
    expect(describeMerge({ trips: 0, people: 0, items: 0, kits: 0 })).toBe('Nothing to move');
  });
});

describe('parsePending', () => {
  it('reads what the current version writes', () => {
    expect(parsePending([{ household: 'h1', person: 'p1' }])).toEqual([
      { household: 'h1', person: 'p1' },
    ]);
  });

  /** Written before the person id existed. Still the only pointer to somebody's trips. */
  it('still honors the bare household id the first version wrote', () => {
    expect(parsePending(['h1'])).toEqual([{ household: 'h1', person: undefined }]);
  });

  it('drops junk rather than trusting it', () => {
    expect(parsePending([null, 42, {}, { person: 'p1' }, ''])).toEqual([]);
    expect(parsePending(undefined)).toEqual([]);
  });
});

describe('strandedElsewhere', () => {
  /**
   * The nonsense this prevents: a reconcile screen listing the exact trips, people and items
   * already on screen, because the "stranded" household is the one you're looking at.
   *
   * It gets recorded when a sign-in happens on a session that was never a guest — signing in
   * while already signed in, which the welcome screen invites by design because it can't tell.
   * There was no second identity, so `created: false` meant only "this email isn't new".
   */
  it('drops an entry naming the household you are already in', () => {
    const pending = [{ household: 'mine' }, { household: 'left-behind' }];
    expect(strandedElsewhere(pending, 'mine')).toEqual([{ household: 'left-behind' }]);
  });

  it('keeps everything when none of it is the current household', () => {
    const pending = [{ household: 'a' }, { household: 'b' }];
    expect(strandedElsewhere(pending, 'mine')).toEqual(pending);
  });

  /**
   * While the household is still loading, every entry looks like somebody else's. Keeping them
   * is right: the merge screen re-checks, and hiding real stranded data would be the worse error.
   */
  it('keeps entries while the current household is still unknown', () => {
    expect(strandedElsewhere([{ household: 'a' }], undefined)).toEqual([{ household: 'a' }]);
  });

  it('drops entries with no household at all', () => {
    expect(strandedElsewhere([{ household: '' }], 'mine')).toEqual([]);
  });
});
