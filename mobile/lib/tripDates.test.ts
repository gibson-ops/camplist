import { nextRange, rangeProblem } from './tripDates';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const empty = { departAt: null, returnAt: null };

describe('nextRange', () => {
  it('pins whatever was picked to local noon', () => {
    const { departAt } = nextRange(empty, 'depart', new Date(2027, 2, 12, 23, 45));
    expect(departAt!.getDate()).toBe(12);
    expect(departAt!.getHours()).toBe(12);
  });

  it('sets a return after the departure', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: null };
    expect(nextRange(start, 'return', day(2027, 3, 16)).returnAt!.getDate()).toBe(16);
  });

  // The same day out and back is a day trip, not an error.
  it('allows a return on the departure day', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: null };
    expect(nextRange(start, 'return', day(2027, 3, 12)).returnAt).not.toBeNull();
  });

  /**
   * THE ONE THE PICKER COULDN'T ENFORCE. `min` on an input and `minimumDate` on a native picker
   * constrain what the WIDGET offers, not what can be stored — a desktop browser lets someone
   * type an earlier date straight into the field, and an invalid input still fires a change.
   */
  it('refuses a return before the departure', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: null };
    expect(nextRange(start, 'return', day(2027, 3, 5))).toEqual(start);
  });

  // Refused, not clamped: clamping would quietly record a day nobody chose.
  it('leaves an existing return untouched when the new one is out of range', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: day(2027, 3, 16) };
    expect(nextRange(start, 'return', day(2027, 3, 1))).toEqual(start);
  });

  it('accepts any return when there is no departure to measure against', () => {
    expect(nextRange(empty, 'return', day(2027, 3, 5)).returnAt).not.toBeNull();
  });

  it('drops a return that a later departure has overtaken', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: day(2027, 3, 16) };
    expect(nextRange(start, 'depart', day(2027, 3, 20)).returnAt).toBeNull();
  });

  it('keeps a return the new departure still precedes', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: day(2027, 3, 16) };
    expect(nextRange(start, 'depart', day(2027, 3, 14)).returnAt!.getDate()).toBe(16);
  });

  // A return with nothing to return from is not half a range, it's nothing.
  it('clears the return along with the departure', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: day(2027, 3, 16) };
    expect(nextRange(start, 'depart', null)).toEqual(empty);
  });

  it('clears only the return when the return is cleared', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: day(2027, 3, 16) };
    const next = nextRange(start, 'return', null);
    expect(next.returnAt).toBeNull();
    expect(next.departAt).toBe(start.departAt);
  });

  // Whatever comes out has to be a range the rest of the app can read.
  it('never produces an inverted range', () => {
    const days = [day(2027, 3, 1), day(2027, 3, 12), day(2027, 3, 20)];
    for (const from of days) {
      for (const to of days) {
        for (const which of ['depart', 'return'] as const) {
          const next = nextRange({ departAt: from, returnAt: to.getTime() >= from.getTime() ? to : null }, which, to);
          if (next.departAt && next.returnAt) {
            expect(+next.returnAt).toBeGreaterThanOrEqual(+next.departAt);
          }
        }
      }
    }
  });
});

describe('rangeProblem', () => {
  /**
   * `nextRange` refusing quietly is worse than it sounds. The picker's own minimum doesn't
   * always grey out the days it should — a wheel-style mobile picker lets you land on one — so
   * a refusal with no explanation reads as the app ignoring you.
   */
  it('explains a return picked before the departure', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: null };
    expect(rangeProblem(start, 'return', day(2027, 3, 5))).toMatch(/before Mar 12/);
  });

  it('says nothing about a pick that will be accepted', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: null };
    expect(rangeProblem(start, 'return', day(2027, 3, 16))).toBeUndefined();
    expect(rangeProblem(start, 'return', day(2027, 3, 12))).toBeUndefined();
  });

  it('says nothing when there is no departure to be before', () => {
    expect(rangeProblem(empty, 'return', day(2027, 3, 5))).toBeUndefined();
  });

  // Departure is never refused — a later one drops the stale return instead.
  it('never complains about the departure field', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: day(2027, 3, 16) };
    expect(rangeProblem(start, 'depart', day(2027, 3, 20))).toBeUndefined();
  });

  it('says nothing when a date is being cleared', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: day(2027, 3, 16) };
    expect(rangeProblem(start, 'return', null)).toBeUndefined();
  });

  // The two have to agree: anything explained must actually be refused, and vice versa.
  it('fires exactly when nextRange refuses', () => {
    const start = { departAt: day(2027, 3, 12), returnAt: null };
    for (const d of [day(2027, 3, 1), day(2027, 3, 12), day(2027, 3, 20)]) {
      const refused = nextRange(start, 'return', d).returnAt === null;
      expect(Boolean(rangeProblem(start, 'return', d))).toBe(refused);
    }
  });
});
