import { nameCorpus, type NamedTripRow } from './itemNames';

const trip = (...items: NonNullable<NonNullable<NamedTripRow['lists']>[number]['items']>) =>
  ({ lists: [{ items }] }) as NamedTripRow;

const byName = (rows: { name: string; weight: number }[]) =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name)).map((r) => [r.name, r.weight]);

describe('nameCorpus', () => {
  it('collects every name the household has written', () => {
    expect(byName(nameCorpus([trip({ name: 'Tent' }, { name: 'Lantern' })]))).toEqual([
      ['Lantern', 1],
      ['Tent', 1],
    ]);
  });

  it('counts a name once per trip, however many lists carried it', () => {
    // Four people each bring a towel: one household using one word, not four pieces of evidence.
    const towels: NamedTripRow = {
      lists: [
        { items: [{ name: 'Towel' }] },
        { items: [{ name: 'Towel' }] },
        { items: [{ name: 'Towel' }, { name: 'Tent' }] },
      ],
    };
    expect(byName(nameCorpus([towels]))).toEqual([
      ['Tent', 1],
      ['Towel', 1],
    ]);
  });

  it('weighs a name by how many trips used it', () => {
    const rows = nameCorpus([
      trip({ name: 'Tent' }),
      trip({ name: 'Tent' }),
      trip({ name: 'Rod' }),
    ]);
    expect(byName(rows)).toEqual([
      ['Rod', 1],
      ['Tent', 2],
    ]);
  });

  it('groups spellings that differ only in case and offers the commonest', () => {
    const rows = nameCorpus([
      trip({ name: 'Headlamp' }),
      trip({ name: 'Headlamp' }),
      trip({ name: 'headlamp' }),
    ]);
    expect(byName(rows)).toEqual([['Headlamp', 3]]);
  });

  it('picks the spelling by how often it is written, counting every list', () => {
    // Two lists say "headlamp" and one says "Headlamp", all on the same trip. The trip is still
    // one vote for the WORD; the spelling is decided by usage.
    const listed = (...spellings: string[]): NamedTripRow => ({
      lists: spellings.map((name) => ({ items: [{ name }] })),
    });

    // The minority spelling comes FIRST here, so anything that lets arrival order decide answers
    // "Headlamp" — and the query does not promise an order.
    expect(byName(nameCorpus([listed('Headlamp', 'headlamp', 'headlamp')]))).toEqual([
      ['headlamp', 1],
    ]);
    // Same rows, different order, same answer. That is the property, not the tally.
    expect(byName(nameCorpus([listed('headlamp', 'headlamp', 'Headlamp')]))).toEqual([
      ['headlamp', 1],
    ]);
  });

  it('breaks a spelling tie alphabetically so two renders agree', () => {
    const rows = nameCorpus([trip({ name: 'headlamp' }), trip({ name: 'Headlamp' })]);
    expect(byName(rows)).toEqual([['Headlamp', 2]]);
  });

  it('includes a kit’s contents, which are names like any other', () => {
    const kitchen = trip({
      name: 'Camp kitchen',
      group: { id: 'g1' },
      children: [{ name: 'Skillet' }, { name: 'Tongs' }],
    });
    expect(byName(nameCorpus([kitchen]))).toEqual([
      ['Skillet', 1],
      ['Tongs', 1],
    ]);
  });

  it('excludes the kit row itself, so completing it cannot make an empty box', () => {
    const rows = nameCorpus([trip({ name: 'Camp kitchen', group: { id: 'g1' } })]);
    expect(rows).toEqual([]);
  });

  it('includes one-off items, because completing is not suggesting', () => {
    // `oneOff` means "never suggest this again" — but you already typed it, so this is retrieval.
    const rows = nameCorpus([trip({ name: 'Costume', oneOff: true } as { name: string })]);
    expect(byName(rows)).toEqual([['Costume', 1]]);
  });

  it('ignores blank names', () => {
    expect(nameCorpus([trip({ name: '   ' })])).toEqual([]);
  });

  it('keys by the same rule the duplicate guard uses', () => {
    // itemKey collapses case and whitespace and nothing else, so these are one name...
    expect(byName(nameCorpus([trip({ name: 'Tent' }), trip({ name: '  tent ' })]))).toEqual([
      ['Tent', 2],
    ]);
    // ...and these are deliberately two.
    expect(byName(nameCorpus([trip({ name: 'Tent' }, { name: 'Tent (spare)' })]))).toEqual([
      ['Tent', 1],
      ['Tent (spare)', 1],
    ]);
  });

  it('survives trips with no lists and lists with no items', () => {
    expect(nameCorpus([{}, { lists: [{}] }])).toEqual([]);
  });
});
