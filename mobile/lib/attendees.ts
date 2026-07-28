/**
 * The rules connecting WHO IS GOING to WHERE THEY PACK.
 *
 * Attendance and lists are two different facts that have to stay in step without being the
 * same thing. `trip.attendees` is metadata — it's part of the query that drives suggestions.
 * A list with an owner is packing structure. Someone can plausibly be on a trip without their
 * own list (a toddler packed for by a parent), but nobody should have a list on a trip they
 * aren't on.
 *
 * Kept as a pure planner, separate from the transaction that runs it, because the interesting
 * part is the DELETION rule and that deserves to be provable without a database.
 */

/** One of this trip's lists, reduced to what the rules actually look at. */
export type TripList = {
  id: string;
  /** undefined for the shared list, which belongs to the trip rather than to a person. */
  ownerId?: string;
  itemCount: number;
};

export type AttendeePlan = {
  /** People to link as attendees. */
  link: string[];
  /** People to unlink. */
  unlink: string[];
  /** People who are going and have nowhere to pack. */
  addListFor: string[];
  /** Lists that were scaffolding for someone no longer going, and are safe to drop. */
  removeLists: string[];
};

/**
 * Works out the writes that move a trip's attendance from `current` to `next`.
 *
 * The rule worth stating out loud is what happens when someone is REMOVED. Deleting their list
 * with it would be the tidy answer and the wrong one: the list may hold an evening's work, and
 * a mis-tap on a chip is not consent to throw that away. So an emptied-out list — the one we
 * created ourselves when they were added, never touched since — is cleaned up, and a list with
 * anything on it survives its owner leaving. The trip screen already offers to re-add a
 * person's list, so the recoverable case is the one we leave to the user.
 *
 * Missing lists are also repaired for anyone in `next`, which is what quietly heals a trip made
 * before attendees existed.
 *
 * @param current person ids currently linked as attendees
 * @param next person ids that should be linked
 * @param lists every list on this trip, shared one included (it has no owner, so it is never
 *              a candidate for removal)
 */
export function planAttendees({
  current,
  next,
  lists,
}: {
  current: string[];
  next: string[];
  lists: TripList[];
}): AttendeePlan {
  const currentSet = new Set(current);
  const nextSet = new Set(next);
  const listOwners = new Set(lists.map((l) => l.ownerId).filter(Boolean));

  const unlink = current.filter((p) => !nextSet.has(p));
  const leaving = new Set(unlink);

  return {
    link: next.filter((p) => !currentSet.has(p)),
    unlink,
    addListFor: next.filter((p) => !listOwners.has(p)),
    removeLists: lists
      .filter((l) => l.ownerId && leaving.has(l.ownerId) && l.itemCount === 0)
      .map((l) => l.id),
  };
}
