import { groupTrips, LATER_SHOWN, UP_NEXT_DAYS } from './tripGroups';

const NOW = +new Date('2026-07-30T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

/** A trip that departs and returns `inDays` from now. */
const trip = (name: string, inDays: number | null, lengthDays = 2) => ({
  name,
  departAt: inDays === null ? null : new Date(NOW + inDays * DAY).toISOString(),
  returnAt: inDays === null ? null : new Date(NOW + (inDays + lengthDays) * DAY).toISOString(),
  createdAt: new Date(NOW).toISOString(),
});

const names = (rows: { name: string }[]) => rows.map((r) => r.name);
const group = (trips: ReturnType<typeof trip>[]) => groupTrips({ trips, now: NOW });

describe('groupTrips', () => {
  it('puts anything within ten days in up next, soonest first', () => {
    const g = group([trip('Later', 40), trip('Soon', 3), trip('Also soon', 9)]);
    expect(names(g.upNext)).toEqual(['Soon', 'Also soon']);
  });

  it('leaves a trip beyond the window out of up next', () => {
    const g = group([trip('Distant', UP_NEXT_DAYS + 1), trip('Close', 1)]);
    expect(names(g.upNext)).toEqual(['Close']);
    expect(names(g.later)).toEqual(['Distant']);
  });

  /**
   * "Up next" with nothing under it reads as having no trips at all, so when the diary is empty for
   * a month the soonest one is promoted regardless of distance.
   */
  it('promotes the soonest trip when nothing is close', () => {
    const g = group([trip('Autumn', 60), trip('Winter', 120)]);
    expect(names(g.upNext)).toEqual(['Autumn']);
    expect(names(g.later)).toEqual(['Winter']);
  });

  /**
   * THE ONE THAT MATTERS ON THE DAY. Jared leaves tomorrow: a trip already underway must not fall
   * into Past, because the day you set off is the day the list is read most and the home screen is
   * where you land. It gets its own group rather than sitting in "Up next", which is the wrong word
   * for a trip you are on.
   */
  it('gives a trip you are already on its own group', () => {
    const g = group([trip('Underway', -1, 4)]);
    expect(names(g.current)).toEqual(['Underway']);
    expect(g.upNext).toEqual([]);
    expect(g.past).toEqual([]);
  });

  it('does not repeat a current trip under up next', () => {
    const g = group([trip('Underway', -1, 4), trip('Soon', 3)]);
    expect(names(g.current)).toEqual(['Underway']);
    expect(names(g.upNext)).toEqual(['Soon']);
  });

  it('has no current group when nothing has departed', () => {
    const g = group([trip('Soon', 2), trip('Done', -20)]);
    expect(g.current).toEqual([]);
  });

  /**
   * Dates here are DAYS. A trip returning today is still on today — comparing against midnight
   * would retire it while Jared is still driving home.
   */
  it('counts the return day as still on the trip', () => {
    const returningToday = {
      name: 'Nearly home',
      departAt: new Date(NOW - 3 * DAY).toISOString(),
      returnAt: new Date(NOW - 11 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(NOW).toISOString(),
    };

    const g = group([returningToday]);
    expect(names(g.current)).toEqual(['Nearly home']);
    expect(g.past).toEqual([]);
  });

  it('treats a finished trip as past, newest first', () => {
    const g = group([trip('Ancient', -90), trip('Recent', -5)]);
    expect(names(g.past)).toEqual(['Recent', 'Ancient']);
    expect(g.upNext).toEqual([]);
  });

  it('shows only the soonest three later trips and counts the rest', () => {
    const g = group([trip('Now', 1), ...[20, 30, 40, 50, 60].map((d) => trip(`In ${d}`, d))]);
    expect(names(g.later)).toEqual(['In 20', 'In 30', 'In 40']);
    expect(g.later).toHaveLength(LATER_SHOWN);
    expect(g.laterHidden).toBe(2);
  });

  /**
   * A trip with no dates is one being written right now. It can't be sorted against anything, and
   * burying a draft under "Later" would hide whatever is most likely to be in progress.
   */
  it('keeps an undated draft at the top of up next', () => {
    const g = group([trip('Planned', 2), trip('Draft', null)]);
    expect(names(g.upNext)).toEqual(['Draft', 'Planned']);
  });

  it('has nothing to show for a household with no trips', () => {
    const g = group([]);
    expect(g).toEqual({ current: [], upNext: [], later: [], laterHidden: 0, past: [] });
  });
});
