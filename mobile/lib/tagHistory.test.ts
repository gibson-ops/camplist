import { tagsInUse } from './tagHistory';

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
