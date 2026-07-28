import { planAttendees, type TripList } from './attendees';

/** The shared list: no owner, so no rule here should ever touch it. */
const shared: TripList = { id: 'l-shared', itemCount: 4 };

const listFor = (person: string, itemCount = 0): TripList => ({
  id: `l-${person}`,
  ownerId: person,
  itemCount,
});

describe('planAttendees', () => {
  it('links whoever is newly going and unlinks whoever is not', () => {
    const plan = planAttendees({
      current: ['jared', 'brooke'],
      next: ['jared', 'walker'],
      lists: [shared, listFor('jared', 3), listFor('brooke', 2)],
    });

    expect(plan.link).toEqual(['walker']);
    expect(plan.unlink).toEqual(['brooke']);
  });

  it('does nothing at all when the set is unchanged', () => {
    const plan = planAttendees({
      current: ['jared'],
      next: ['jared'],
      lists: [shared, listFor('jared')],
    });

    expect(plan).toEqual({ link: [], unlink: [], addListFor: [], removeLists: [] });
  });

  it('gives everyone who is going somewhere to pack', () => {
    const plan = planAttendees({
      current: [],
      next: ['jared', 'walker'],
      lists: [shared],
    });

    expect(plan.addListFor).toEqual(['jared', 'walker']);
  });

  /**
   * THE RULE THIS FILE EXISTS FOR.
   *
   * Removing someone deletes their list only when it's empty — that list was scaffolding we
   * created for them and they never wrote on. A list with anything on it survives its owner
   * leaving, because a mis-tapped chip is not consent to throw away an evening of packing.
   */
  it('drops an untouched list when its owner leaves', () => {
    const plan = planAttendees({
      current: ['jared', 'walker'],
      next: ['jared'],
      lists: [shared, listFor('jared', 3), listFor('walker', 0)],
    });

    expect(plan.removeLists).toEqual(['l-walker']);
  });

  it('keeps a list that has anything on it, even when its owner leaves', () => {
    const plan = planAttendees({
      current: ['jared', 'walker'],
      next: ['jared'],
      lists: [shared, listFor('jared', 3), listFor('walker', 1)],
    });

    expect(plan.unlink).toEqual(['walker']);
    expect(plan.removeLists).toEqual([]);
  });

  it('never removes the shared list, which belongs to the trip rather than to anyone', () => {
    const plan = planAttendees({
      current: ['jared'],
      next: [],
      lists: [{ id: 'l-shared', itemCount: 0 }, listFor('jared', 0)],
    });

    expect(plan.removeLists).toEqual(['l-jared']);
  });

  /**
   * Trips created before attendance existed have people visible only as list owners. Selecting
   * them records the fact without creating a second list on top of the one already there.
   */
  it('backfills an old trip by linking its list owners and building nothing', () => {
    const plan = planAttendees({
      current: [],
      next: ['jared', 'walker'],
      lists: [shared, listFor('jared', 5), listFor('walker', 2)],
    });

    expect(plan.link).toEqual(['jared', 'walker']);
    expect(plan.addListFor).toEqual([]);
    expect(plan.removeLists).toEqual([]);
  });

  // Someone already going but with no list is a broken trip, not a no-op.
  it('repairs a missing list for someone already on the trip', () => {
    const plan = planAttendees({
      current: ['jared', 'walker'],
      next: ['jared', 'walker'],
      lists: [shared, listFor('jared', 1)],
    });

    expect(plan.link).toEqual([]);
    expect(plan.addListFor).toEqual(['walker']);
  });
});
