import { tagsInUse, tagsLikeThisTrip } from './tagHistory';
import { shapeOf, type TripRow } from './similarity';

const trip = (activities: unknown) => ({ activities });

describe('tagsInUse', () => {
  it('ranks by how often the household actually uses a tag', () => {
    const trips = [
      trip(['Hiking', 'Fishing']),
      trip(['Hiking']),
      trip(['Hiking', 'Stargazing']),
      trip(['Fishing']),
    ];

    expect(tagsInUse(trips, 'activities')).toEqual(['Hiking', 'Fishing', 'Stargazing']);
  });

  /**
   * Ties break on first appearance rather than arbitrarily, so the `+` sheet doesn't reshuffle
   * itself between renders while the user is looking at it.
   */
  it('breaks ties on first appearance, so the order is stable', () => {
    const trips = [trip(['Biking', 'Golf']), trip(['Golf', 'Biking'])];
    expect(tagsInUse(trips, 'activities')).toEqual(['Biking', 'Golf']);
  });

  // Counting is what makes this the seed of the learning loop; spelling drift would split the
  // count in half and bury a tag the household leans on.
  it('counts spellings of the same tag together and shows the first one', () => {
    const trips = [trip(['Cold nights']), trip(['cold nights']), trip(['COLD NIGHTS'])];
    expect(tagsInUse(trips, 'activities')).toEqual(['Cold nights']);
  });

  it('survives junk in the column', () => {
    const trips = [trip(undefined), trip('Hiking'), trip([42, null, 'Hiking'])];
    expect(tagsInUse(trips, 'activities')).toEqual(['Hiking']);
  });

  it('is empty for a household with no history', () => {
    expect(tagsInUse([], 'activities')).toEqual([]);
  });

  it('reads the field it was asked for and no other', () => {
    const trips = [{ activities: ['Hiking'], conditions: ['Cold nights'] }];
    expect(tagsInUse(trips, 'conditions')).toEqual(['Cold nights']);
  });
});

describe('tagsLikeThisTrip', () => {
  const NOW = +new Date('2026-07-28T12:00:00');

  const camping = (id: string, activities: string[]): TripRow => ({
    id,
    name: id,
    tripTypes: ['Camping'],
    travelModes: ['Driving'],
    lodgings: ['Tent'],
    activities,
    departAt: '2025-09-04',
    attendees: [{ id: 'jared' }],
  });

  const conference = (id: string, activities: string[]): TripRow => ({
    id,
    name: id,
    tripTypes: ['Work'],
    travelModes: ['Flying'],
    lodgings: ['Hotel'],
    activities,
    departAt: '2025-06-01',
    attendees: [{ id: 'jared' }],
  });

  const current = shapeOf({ ...camping('next', []), departAt: '2026-09-04' }, NOW);
  const ask = (past: TripRow[]) => tagsLikeThisTrip({ current, past, axis: 'activities', now: NOW });

  /**
   * The whole reason this exists next to `tagsInUse`. Raw frequency can't tell the two halves of
   * a household's life apart, so it would offer "Presenting" on a camping trip.
   */
  it('ignores tags from the half of your life this trip is not', () => {
    const past = [
      camping('uintas', ['Rockhounding']),
      conference('chicago-1', ['Presenting']),
      conference('chicago-2', ['Presenting']),
      conference('chicago-3', ['Presenting']),
    ];

    expect(tagsInUse(past, 'activities')).toEqual(['Presenting', 'Rockhounding']);
    expect(ask(past)).toEqual(['Rockhounding']);
  });

  it('ranks by how much the past trip resembles this one, not by how often', () => {
    const past = [
      camping('twin', ['Fishing']),
      { ...camping('far', ['Hiking']), lodgings: ['Cabin'], travelModes: ['Flying'] },
      { ...camping('far-2', ['Hiking']), lodgings: ['Cabin'], travelModes: ['Flying'] },
    ];

    expect(ask(past)[0]).toBe('Fishing');
  });

  it('reads the axis it was asked for', () => {
    const past = [{ ...camping('uintas', ['Fishing']), conditions: ['Cold nights'] }];

    expect(tagsLikeThisTrip({ current, past, axis: 'conditions', now: NOW })).toEqual([
      'Cold nights',
    ]);
    expect(tagsLikeThisTrip({ current, past, axis: 'lodgings', now: NOW })).toEqual(['Tent']);
  });

  it('has no opinion when nothing in the household is like this trip', () => {
    expect(ask([conference('chicago', ['Presenting'])])).toEqual([]);
  });

  it('is empty for a household with no history', () => {
    expect(ask([])).toEqual([]);
  });
});
