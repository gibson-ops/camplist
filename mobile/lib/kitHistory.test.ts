import { kitsFromHistory } from './kitHistory';

type Child = { name: string; consumable?: boolean; checkReason?: string; oneOff?: boolean };

/** A trip carrying one kit, dated so recency is unambiguous. */
const tripWithKit = (
  name: string,
  departAt: string,
  kit: string,
  children: Child[],
  extra: Record<string, unknown> = {},
) =>
  ({
    id: name,
    name,
    departAt,
    createdAt: departAt,
    lists: [{ items: [{ name: kit, group: { id: `g-${kit}` }, children, ...extra }] }],
  }) as Parameters<typeof kitsFromHistory>[0][number];

const names = (contents: { name: string }[]) => contents.map((c) => c.name);

describe('kitsFromHistory', () => {
  it('brings a kit back with what was in it', () => {
    const kits = kitsFromHistory([
      tripWithKit('Bryce', '2026-01-01', 'Kitchen Box', [
        { name: 'Skillet' },
        { name: 'Propane', consumable: true, checkReason: 'empty' },
      ]),
    ]);

    expect(kits).toHaveLength(1);
    expect(kits[0].name).toBe('Kitchen Box');
    expect(names(kits[0].contents)).toEqual(['Skillet', 'Propane']);
  });

  /**
   * THE MEMBER / PASSENGER LINE, and the reason this feature is safe to make automatic. A kit's
   * contents are two different kinds of thing — what belongs in the box, and what rode along once.
   * `oneOff` ("Just this trip") already draws that line everywhere else.
   */
  it('leaves behind anything marked just this trip', () => {
    const kits = kitsFromHistory([
      tripWithKit('Bryce', '2026-01-01', 'Kitchen Box', [
        { name: 'Skillet' },
        { name: 'Wedding gift', oneOff: true },
      ]),
    ]);

    expect(names(kits[0].contents)).toEqual(['Skillet']);
  });

  it('carries the check reason through, so a re-made kit still says what to look for', () => {
    const kits = kitsFromHistory([
      tripWithKit('Bryce', '2026-01-01', 'Kitchen Box', [
        { name: 'Propane', consumable: true, checkReason: 'empty' },
        { name: 'Lantern', consumable: true, checkReason: 'charged' },
        { name: 'Skillet' },
      ]),
    ]);

    expect(kits[0].contents).toEqual([
      { name: 'Propane', consumable: true, checkReason: 'empty' },
      { name: 'Lantern', consumable: true, checkReason: 'charged' },
      { name: 'Skillet', consumable: false, checkReason: undefined },
    ]);
  });

  it('reads a stored reason through reasonOf rather than raw', () => {
    // 'replace' shipped briefly and is aliased onto 'other'; a consumable that never said one
    // falls to the default.
    const kits = kitsFromHistory([
      tripWithKit('Bryce', '2026-01-01', 'Kit', [
        { name: 'Filter', consumable: true, checkReason: 'replace' },
        { name: 'Matches', consumable: true },
      ]),
    ]);

    expect(kits[0].contents.map((c) => c.checkReason)).toEqual(['other', 'empty']);
  });

  it('takes the contents from the MOST RECENT trip that carried it', () => {
    const kits = kitsFromHistory([
      tripWithKit('older', '2025-01-01', 'Kitchen Box', [{ name: 'Old skillet' }]),
      tripWithKit('newer', '2026-06-01', 'Kitchen Box', [{ name: 'Cast iron skillet' }]),
    ]);

    expect(kits).toHaveLength(1);
    expect(names(kits[0].contents)).toEqual(['Cast iron skillet']);
    expect(kits[0].from).toBe('newer');
  });

  it('still counts the older trips toward how established the kit is', () => {
    const kits = kitsFromHistory([
      tripWithKit('a', '2024-01-01', 'Kitchen Box', [{ name: 'Skillet' }]),
      tripWithKit('b', '2025-01-01', 'Kitchen Box', [{ name: 'Skillet' }]),
      tripWithKit('c', '2026-01-01', 'Kitchen Box', [{ name: 'Skillet' }]),
    ]);

    expect(kits[0].trips).toBe(3);
  });

  it('offers the most-carried kit first', () => {
    const kits = kitsFromHistory([
      tripWithKit('a', '2024-01-01', 'Kitchen Box', [{ name: 'Skillet' }]),
      tripWithKit('b', '2025-01-01', 'Kitchen Box', [{ name: 'Skillet' }]),
      tripWithKit('c', '2026-01-01', 'Paddle boards', [{ name: 'Paddle' }]),
    ]);

    expect(kits.map((k) => k.name)).toEqual(['Kitchen Box', 'Paddle boards']);
  });

  /** An empty box reads as handled and isn't — the exact failure this feature avoids. */
  it('never offers a kit with nothing to bring', () => {
    expect(kitsFromHistory([tripWithKit('a', '2026-01-01', 'Empty box', [])])).toEqual([]);
    expect(
      kitsFromHistory([
        tripWithKit('a', '2026-01-01', 'All one-offs', [{ name: 'X', oneOff: true }]),
      ]),
    ).toEqual([]);
  });

  it('skips kits already on the trip being packed', () => {
    const trips = [tripWithKit('a', '2026-01-01', 'Kitchen Box', [{ name: 'Skillet' }])];

    expect(kitsFromHistory(trips, new Set(['kitchen box']))).toEqual([]);
  });

  /**
   * A KIT IS THE GROUP LINK, not "a row that happens to have children". Every other reader —
   * `itemsOf`, `nameCorpus`, the replay — decides the same way, and a row's children are not the
   * definition. Without the test the guard is masked: a plain row has no children, so it falls out
   * at the empty-contents check and nothing notices which rule did the work.
   */
  it('keys on the group link rather than on having children', () => {
    const impostor = {
      id: 't',
      name: 't',
      departAt: '2026-01-01',
      createdAt: '2026-01-01',
      lists: [{ items: [{ name: 'Not a kit', children: [{ name: 'Skillet' }] }] }],
    } as Parameters<typeof kitsFromHistory>[0][number];

    expect(kitsFromHistory([impostor])).toEqual([]);
  });

  it('ignores plain items, which are names rather than containers', () => {
    const plain = {
      id: 't',
      name: 't',
      departAt: '2026-01-01',
      createdAt: '2026-01-01',
      lists: [{ items: [{ name: 'Tent' }] }],
    } as Parameters<typeof kitsFromHistory>[0][number];

    expect(kitsFromHistory([plain])).toEqual([]);
  });
});
