import { defaultExpanded, isExpanded, parseListPrefs, withExpanded } from './listPrefs';

const JARED = 'person-jared';
const BROOKE = 'person-brooke';

describe('defaultExpanded', () => {
  it('opens the shared list', () => {
    expect(defaultExpanded(undefined, JARED)).toBe(true);
  });

  it('opens my own list', () => {
    expect(defaultExpanded(JARED, JARED)).toBe(true);
  });

  it("closes someone else's list", () => {
    expect(defaultExpanded(BROOKE, JARED)).toBe(false);
  });

  it('closes every owned list before the session knows who I am', () => {
    // personId is undefined for a beat on cold launch. Opening everything and then snapping
    // shut would be worse than starting conservative.
    expect(defaultExpanded(BROOKE, undefined)).toBe(false);
    expect(defaultExpanded(undefined, undefined)).toBe(true);
  });
});

describe('isExpanded', () => {
  it('honours an explicit close on my own list', () => {
    expect(isExpanded('L1', JARED, JARED, { L1: false })).toBe(false);
  });

  it("honours an explicit open on someone else's list", () => {
    expect(isExpanded('L2', BROOKE, JARED, { L2: true })).toBe(true);
  });

  it('leaves untouched lists on the default', () => {
    expect(isExpanded('L3', BROOKE, JARED, { L1: false })).toBe(false);
    expect(isExpanded('L4', undefined, JARED, { L1: false })).toBe(true);
  });

  it('falls back to the default when prefs have not loaded', () => {
    expect(isExpanded('L1', JARED, JARED, undefined)).toBe(true);
  });
});

describe('withExpanded', () => {
  it('stores a genuine override', () => {
    expect(withExpanded({}, 'L1', false, JARED, JARED)).toEqual({ L1: false });
    expect(withExpanded({}, 'L2', true, BROOKE, JARED)).toEqual({ L2: true });
  });

  // The point of the whole module: an untouched list must keep following the default, so
  // returning a list to its default state has to DELETE the key rather than pin it. Without
  // this, changing the default later would fight a database full of stale values.
  it('drops the key when the choice returns to the default', () => {
    expect(withExpanded({ L1: false }, 'L1', true, JARED, JARED)).toEqual({});
    expect(withExpanded({ L2: true }, 'L2', false, BROOKE, JARED)).toEqual({});
  });

  it('leaves other lists alone', () => {
    expect(withExpanded({ L1: false }, 'L2', true, BROOKE, JARED)).toEqual({
      L1: false,
      L2: true,
    });
  });

  it('does not mutate the prefs it was given', () => {
    const prefs = { L1: false };
    withExpanded(prefs, 'L2', true, BROOKE, JARED);
    expect(prefs).toEqual({ L1: false });
  });
});

describe('parseListPrefs', () => {
  it('passes through a clean map', () => {
    expect(parseListPrefs({ L1: true, L2: false })).toEqual({ L1: true, L2: false });
  });

  // i.json() is unvalidated storage: an older build, a hand-edited row, or a future shape
  // change can all put non-booleans in here, and a crash on launch would be unrecoverable.
  it('discards anything that is not a boolean', () => {
    expect(parseListPrefs({ L1: true, L2: 'yes', L3: 1, L4: null })).toEqual({ L1: true });
  });

  it('survives junk in the column', () => {
    expect(parseListPrefs(null)).toEqual({});
    expect(parseListPrefs(undefined)).toEqual({});
    expect(parseListPrefs('nope')).toEqual({});
    expect(parseListPrefs([1, 2, 3])).toEqual({});
  });
});
