import { fold, rankNames } from './fuzzy';

const names = (rows: { name: string; weight?: number }[]) => rows.map((r) => r.name);

describe('fold', () => {
  it('strips accents so an unaccented query can find an accented name', () => {
    expect(fold('Café')).toBe('cafe');
  });

  it('lowercases and collapses runs of whitespace', () => {
    expect(fold('  Sleeping   BAG ')).toBe('sleeping bag');
  });
});

describe('rankNames', () => {
  it('returns nothing for an empty query rather than everything', () => {
    expect(rankNames('', [{ name: 'Tent' }, { name: 'Lantern' }], 5)).toEqual([]);
    expect(rankNames('   ', [{ name: 'Tent' }], 5)).toEqual([]);
  });

  it('finds a name buried behind an emoji', () => {
    // The case Jared named: rediscovering that he once typed "🔦 Lantern".
    expect(names(rankNames('lantern', [{ name: '🔦 Lantern' }], 5))).toEqual(['🔦 Lantern']);
  });

  it('matches a word inside a name, not only the start of it', () => {
    expect(names(rankNames('bag', [{ name: 'Sleeping bag' }, { name: 'Dry-bag' }], 5))).toEqual([
      'Dry-bag',
      'Sleeping bag',
    ]);
  });

  it('puts a word match ahead of a better-attested match found mid-word', () => {
    // A word boundary means the author meant that word; "bag" inside "Handbag" is a coincidence
    // of spelling. Without the distinction, weight alone answers "Handbag".
    const rows = [
      { name: 'Handbag', weight: 20 },
      { name: 'Dry-bag', weight: 1 },
    ];
    expect(names(rankNames('bag', rows, 5))).toEqual(['Dry-bag', 'Handbag']);
  });

  it('puts a plain prefix ahead of a better-attested word match', () => {
    // Tier beats weight: something that simply starts with what you typed always wins.
    const rows = [
      { name: 'Spare lantern', weight: 20 },
      { name: 'Lantern', weight: 1 },
    ];
    expect(names(rankNames('lan', rows, 5))).toEqual(['Lantern', 'Spare lantern']);
  });

  it('ranks by weight before length, so the household word beats the short word', () => {
    // Typing "hea" against a household that owns all three: length alone answers "Heater".
    const rows = [
      { name: 'Heater', weight: 1 },
      { name: 'Headlamp', weight: 20 },
      { name: 'Head net', weight: 2 },
    ];
    expect(names(rankNames('hea', rows, 5))).toEqual(['Headlamp', 'Head net', 'Heater']);
  });

  it('breaks equal evidence with the shorter name', () => {
    const rows = [
      { name: 'Tent stakes', weight: 3 },
      { name: 'Tent', weight: 3 },
    ];
    expect(names(rankNames('tent', rows, 5))).toEqual(['Tent', 'Tent stakes']);
  });

  it('orders identical candidates by name so two renders agree', () => {
    const rows = [{ name: 'Tarp B' }, { name: 'Tarp A' }];
    expect(names(rankNames('tarp', rows, 5))).toEqual(['Tarp A', 'Tarp B']);
  });

  it('matches dropped letters once the query is long enough to be an abbreviation', () => {
    expect(names(rankNames('hdlmp', [{ name: 'Headlamp' }], 5))).toEqual(['Headlamp']);
  });

  it('refuses to match loosely on a query too short to mean anything', () => {
    // "ae" is a subsequence of half a packing list; two letters is not an abbreviation.
    expect(rankNames('ae', [{ name: 'Axe handle' }], 5)).toEqual([]);
  });

  it('honours the limit', () => {
    const rows = [{ name: 'Tarp A' }, { name: 'Tarp B' }, { name: 'Tarp C' }];
    expect(names(rankNames('tarp', rows, 2))).toEqual(['Tarp A', 'Tarp B']);
  });

  it('finds an accented name from an unaccented query', () => {
    expect(names(rankNames('cafe', [{ name: 'Café press' }], 5))).toEqual(['Café press']);
  });
});
