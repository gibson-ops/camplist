import { placesOnTrip, type PlacedList } from './places';

const shared: PlacedList = {
  id: 'l1',
  name: 'Shared',
  items: [
    { id: 'i1', name: 'Tent' },
    {
      id: 'i2',
      name: 'Camp kitchen',
      children: [{ name: 'Matches' }, { name: 'Skillet' }],
    },
  ],
};

const mine: PlacedList = {
  id: 'l2',
  name: 'Me',
  items: [{ id: 'i3', name: 'Headlamp' }],
};

const where = (places: { key: string; where: string }[], key: string) =>
  places.find((p) => p.key === key)?.where;

describe('placesOnTrip', () => {
  it('names the list a top-level item sits on', () => {
    expect(where(placesOnTrip([shared, mine]), 'headlamp')).toBe('Me');
  });

  /**
   * THE DUPLICATE THAT ACTUALLY GETS MADE. A kit hides its contents behind a collapsed row, so
   * the matches in the camp kitchen are invisible from the shared list — and the Add button
   * won't stop you, because a different container is a legitimate place for a second one.
   */
  it('names the KIT holding a content, not the list under it', () => {
    expect(where(placesOnTrip([shared]), 'matches')).toBe('Camp kitchen');
  });

  it('counts a kit row as a name too', () => {
    expect(where(placesOnTrip([shared]), 'camp kitchen')).toBe('Shared');
  });

  it('skips the list being added to, which is the button’s business', () => {
    const places = placesOnTrip([shared, mine], { listId: 'l1' });

    expect(where(places, 'tent')).toBeUndefined();
    expect(where(places, 'headlamp')).toBe('Me');
  });

  it('still reports a kit’s contents when adding to the list the kit sits on', () => {
    // Skipping the list must not skip what is inside the boxes on it — that is the whole feature.
    const places = placesOnTrip([shared], { listId: 'l1' });

    expect(where(places, 'matches')).toBe('Camp kitchen');
  });

  it('skips the kit being added to, and nothing else', () => {
    const places = placesOnTrip([shared], { parentId: 'i2' });

    expect(where(places, 'matches')).toBeUndefined();
    expect(where(places, 'tent')).toBe('Shared');
  });

  it('reports the first container when a name sits in two', () => {
    const twice: PlacedList[] = [
      { id: 'l1', name: 'Shared', items: [{ id: 'i1', name: 'Matches' }] },
      { id: 'l2', name: 'Me', items: [{ id: 'i2', name: 'Matches' }] },
    ];
    expect(where(placesOnTrip(twice), 'matches')).toBe('Shared');
  });

  it('keys the same way the duplicate guard does', () => {
    const cased: PlacedList[] = [
      { id: 'l1', name: 'Shared', items: [{ id: 'i1', name: '  TENT ' }] },
    ];
    expect(where(placesOnTrip(cased), 'tent')).toBe('Shared');
  });

  it('ignores blank names and lists with no items', () => {
    expect(placesOnTrip([{ id: 'l1', name: 'Shared', items: [{ id: 'i1', name: ' ' }] }])).toEqual(
      [],
    );
    expect(placesOnTrip([{ id: 'l1', name: 'Shared' }])).toEqual([]);
  });
});
