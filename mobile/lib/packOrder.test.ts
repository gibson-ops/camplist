import { applyOrder, packOrder } from './packOrder';

const row = (id: string, state: string, sortOrder = 0) => ({
  id,
  state,
  sortOrder,
  createdAt: new Date('2026-07-01'),
});

describe('packOrder', () => {
  it('puts what still needs doing first and what is done last', () => {
    expect(
      packOrder([row('done', 'loaded'), row('todo', 'unpacked'), row('packed', 'packed')]),
    ).toEqual(['todo', 'packed', 'done']);
  });

  /** Re-sorting must not scramble rows that share a state — the list keeps its own order inside. */
  it('keeps the list order within a state', () => {
    expect(
      packOrder([row('b', 'unpacked', 2), row('a', 'unpacked', 1), row('c', 'unpacked', 3)]),
    ).toEqual(['a', 'b', 'c']);
  });

  /** A kit's contents are two-state, so `checked` answers instead of the three-state cycle. */
  it('sinks a checked kit content and floats one still waiting', () => {
    const content = (id: string, checked: boolean) => ({
      id,
      checked,
      sortOrder: 0,
      createdAt: new Date('2026-07-01'),
    });
    expect(packOrder([content('good', true), content('waiting', false)])).toEqual([
      'waiting',
      'good',
    ]);
  });
});

describe('applyOrder', () => {
  const rows = [row('a', 'unpacked'), row('b', 'unpacked'), row('c', 'unpacked')];

  it('renders in the frozen order rather than the incoming one', () => {
    expect(applyOrder(rows, ['c', 'a', 'b']).map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  /**
   * THE POINT OF FREEZING. Ticking something changes its state but not the order in hand, so the
   * row stays exactly where it was and nothing moves out from under a thumb.
   */
  it('leaves a row where it was when its state changes', () => {
    const order = packOrder(rows);
    const afterTick = [{ ...rows[0], state: 'loaded' }, rows[1], rows[2]];
    expect(applyOrder(afterTick, order).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  /** Something added since the last re-sort lands at the end, not at the top. */
  it('puts unseen rows after everything it knows', () => {
    const order = packOrder(rows);
    const withNew = [...rows, row('new', 'unpacked')];
    expect(applyOrder(withNew, order).map((r) => r.id)).toEqual(['a', 'b', 'c', 'new']);
  });

  it('cannot resurrect a row that has gone', () => {
    expect(applyOrder([rows[0]], ['a', 'b', 'c']).map((r) => r.id)).toEqual(['a']);
  });
});
