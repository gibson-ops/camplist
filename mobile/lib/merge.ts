/**
 * Bringing guest data into the account someone signs into on that device.
 *
 * The case this exists for: you packed two real trips before ever seeing an email field — which
 * is the whole point of the login-free start — and then signed in with an address that already
 * had an account, because you'd used the app on your phone. Instant keeps both identities: the
 * account becomes yours and the guest is attached to it as a linked guest. Your trips are still
 * there and still permitted, but they belong to a household the app no longer shows.
 *
 * Without this they're gone as far as anyone can tell, which is the single worst thing a
 * login-free start could lead to. Offering the guest start and then eating what people made with
 * it would be worse than never offering it.
 *
 * NO SERVER NEEDED. `instant.perms.ts` already grants the signed-in user access to a linked
 * guest's household — that clause was written for exactly this — so the move is an ordinary
 * client transaction.
 */

/**
 * A household left behind on some device, and the guest's own person inside it.
 *
 * The person id is carried because it can't be discovered later: after signing in you can read a
 * linked guest's PEOPLE but not the profile they point at, so nothing on the row says which of
 * them was you.
 */
export type StrandedHousehold = { household: string; person?: string };

/**
 * Reads `profiles.pendingMerge` back, tolerating the shape it had before the person id.
 *
 * Bare strings were written by the first version and mean "household, owner unknown" — which
 * still merges, just without folding the duplicate person in. Dropping them instead would be
 * throwing away the only pointer to somebody's trips.
 */
export function parsePending(raw: unknown): StrandedHousehold[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry): StrandedHousehold[] => {
    if (typeof entry === 'string') return entry ? [{ household: entry }] : [];
    if (entry && typeof entry === 'object') {
      const { household, person } = entry as Record<string, unknown>;
      if (typeof household === 'string' && household) {
        return [{ household, person: typeof person === 'string' ? person : undefined }];
      }
    }
    return [];
  });
}

/**
 * Pending entries that actually point somewhere else.
 *
 * An entry naming the household you're already in is not a stranded household — it's the one on
 * screen. Offering to move it produces the nonsense Jared hit: a reconcile screen listing the
 * exact trips, people and items already in front of him.
 *
 * It gets written when a sign-in happens on a session that was NOT a guest — signing in while
 * already signed in, say, which the welcome screen invites by design because it can't know. There
 * was no second identity, so `created: false` means only "this email is not new", and the
 * household captured beforehand is the same one that comes back after.
 *
 * Filtered on READ as well as guarded on write, so the entries already stored on real profiles
 * stop appearing without anybody having to run a cleanup.
 */
export function strandedElsewhere(
  pending: StrandedHousehold[],
  currentHousehold?: string,
): StrandedHousehold[] {
  return pending.filter((entry) => entry.household && entry.household !== currentHousehold);
}

/** Every household-scoped row that has to change hands, as it comes out of the query. */
export type GuestHousehold = {
  id: string;
  people: { id: string; name: string; profileId?: string }[];
  trips: { id: string; name: string }[];
  lists: { id: string; ownerId?: string }[];
  items: { id: string }[];
  itemGroups: { id: string }[];
  groupItems: { id: string }[];
  reflections: { id: string; personId?: string }[];
};

export type MergePlan = {
  /**
   * Rows whose denormalized `householdId` must be re-stamped.
   *
   * EVERY row, without exception. The permission rules key on this string, not on the links, so
   * a row that keeps the old value doesn't move — it vanishes, readable by nobody, including the
   * person who just asked for it to be moved.
   */
  restamp: { entity: MergeEntity; ids: string[] }[];
  /** Rows that also carry a real link to the household and need it re-pointed. */
  relink: { entity: 'people' | 'trips' | 'itemGroups'; ids: string[] }[];
  /**
   * The guest's own person record, which is NOT copied across.
   *
   * It's the same human as the signed-in user's person, so bringing it would put "Me" on the
   * household twice with the trips split between them. Everything that pointed at it is
   * re-pointed at the person who already exists.
   */
  absorbPerson?: { from: string; to: string };
  /** Lists whose owner was the guest's own person. */
  reownLists: string[];
  /** Reflections attributed to the guest's own person. */
  reattributeReflections: string[];
  /** What the user is about to move, for saying so before they commit to it. */
  summary: { trips: number; people: number; items: number; kits: number };
};

export type MergeEntity =
  'people' | 'trips' | 'lists' | 'items' | 'itemGroups' | 'groupItems' | 'reflections';

/**
 * What moving a guest household into the signed-in one involves.
 *
 * Pure, so the rules can be tested without a database — and they need testing, because the
 * failure mode is silent. A missed `householdId` doesn't error, it just makes a row unreachable.
 *
 * PEOPLE ARE NOT MATCHED BY NAME. The guest's own person is identified by its link to the guest
 * PROFILE, which is certain; everyone else comes across as a new person even when the name
 * already exists in the destination. Two "Brooke" rows are visible and take one tap to sort out.
 * Silently merging two people who happen to share a name pools their lists, and there's no
 * evidence anywhere that they're the same human.
 *
 * IDENTIFYING THE GUEST'S OWN PERSON takes a recorded id rather than the profile link, because
 * the link is unreadable exactly when it's needed. `profiles.view` is `isSelf || sharesHousehold`,
 * and a linked guest's profile is neither — so after signing in you can read the guest's PEOPLE
 * but not the profile one of them points at. Found by running the merge for real: it offered to
 * move a second "Me" into a household that already had one.
 *
 * The id is captured at sign-in instead, while the guest session can still see itself. The
 * profile link stays as a fallback for when it is readable.
 *
 * @param guest everything in the household being left behind
 * @param guestSelfPersonId the guest's own person, recorded before the identity changed
 * @param selfPersonId the signed-in user's own person, which the guest's own person folds into
 * @returns the plan, or undefined when there is nothing worth moving
 */
export function planMerge({
  guest,
  guestSelfPersonId,
  selfPersonId,
}: {
  guest: GuestHousehold;
  guestSelfPersonId?: string;
  selfPersonId?: string;
}): MergePlan | undefined {
  // The recorded id first, then the profile link. Never the name "Me" — a name is a label
  // anybody can type, and neither of the other two can be typed by anyone.
  const own =
    guest.people.find((person) => person.id === guestSelfPersonId) ??
    guest.people.find((person) => person.profileId);
  const absorbing = own && selfPersonId ? { from: own.id, to: selfPersonId } : undefined;

  const movingPeople = guest.people.filter((person) => person.id !== absorbing?.from);

  const restamp = (
    [
      { entity: 'people', ids: movingPeople.map((p) => p.id) },
      { entity: 'trips', ids: guest.trips.map((t) => t.id) },
      { entity: 'lists', ids: guest.lists.map((l) => l.id) },
      { entity: 'items', ids: guest.items.map((i) => i.id) },
      { entity: 'itemGroups', ids: guest.itemGroups.map((g) => g.id) },
      { entity: 'groupItems', ids: guest.groupItems.map((g) => g.id) },
      { entity: 'reflections', ids: guest.reflections.map((r) => r.id) },
    ] satisfies { entity: MergeEntity; ids: string[] }[]
  ).filter((group) => group.ids.length);

  if (!restamp.length) return undefined;

  return {
    restamp,
    relink: [
      { entity: 'people' as const, ids: movingPeople.map((p) => p.id) },
      { entity: 'trips' as const, ids: guest.trips.map((t) => t.id) },
      { entity: 'itemGroups' as const, ids: guest.itemGroups.map((g) => g.id) },
    ].filter((group) => group.ids.length),
    absorbPerson: absorbing,
    reownLists: absorbing
      ? guest.lists.filter((l) => l.ownerId === absorbing.from).map((l) => l.id)
      : [],
    reattributeReflections: absorbing
      ? guest.reflections.filter((r) => r.personId === absorbing.from).map((r) => r.id)
      : [],
    summary: {
      trips: guest.trips.length,
      // What the user will actually see appear, so the count matches the household screen after.
      people: movingPeople.length,
      items: guest.items.length,
      kits: guest.itemGroups.length,
    },
  };
}

/**
 * A one-line account of what's about to move, for the button that does it.
 *
 * Counts rather than a list, because the list is already on screen above it. Parts with nothing
 * in them drop out instead of reading "0 kits".
 */
export function describeMerge(summary: MergePlan['summary']): string {
  const parts = [
    count(summary.trips, 'trip'),
    count(summary.people, 'person', 'people'),
    count(summary.items, 'item'),
    count(summary.kits, 'kit'),
  ].filter(Boolean);

  if (!parts.length) return 'Nothing to move';
  if (parts.length === 1) return `Move ${parts[0]}`;
  return `Move ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function count(n: number, singular: string, plural = `${singular}s`): string | undefined {
  if (!n) return undefined;
  return `${n} ${n === 1 ? singular : plural}`;
}
