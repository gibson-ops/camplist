import { isAlreadyPresent, itemKey } from './itemKey';

describe('itemKey', () => {
  it('ignores case and stray whitespace, which nobody meant', () => {
    expect(itemKey('  Sleeping Bag ')).toBe(itemKey('sleeping bag'));
    expect(itemKey('Camp  stove')).toBe(itemKey('camp stove'));
  });

  /**
   * THE ESCAPE HATCH, and the reason this is not `slugify`. Blocking duplicates is only safe if a
   * deliberate one is still possible, so anything a person typed on purpose survives.
   */
  it('keeps punctuation, symbols and emoji as real differences', () => {
    expect(itemKey('Tent')).not.toBe(itemKey('Tent!'));
    expect(itemKey('Tent')).not.toBe(itemKey('Tent (spare)'));
    expect(itemKey('Lantern')).not.toBe(itemKey('🔦 Lantern'));
  });

  /** The same character typed two ways is one character, not a hidden duplicate. */
  it('treats composed and decomposed unicode as equal', () => {
    expect(itemKey('Café press')).toBe(itemKey('Café press'));
  });
});

describe('isAlreadyPresent', () => {
  const list = ['Sleeping bag', 'Camp stove', 'Tent'];

  it('spots the same item typed differently', () => {
    expect(isAlreadyPresent('  sleeping   BAG ', list)).toBe(true);
  });

  it('lets a deliberately different name through', () => {
    expect(isAlreadyPresent('Tent (spare)', list)).toBe(false);
    expect(isAlreadyPresent('Sleeping bag liner', list)).toBe(false);
  });

  /** An empty field is not a duplicate of anything — the Add button is already disabled for it. */
  it('says nothing about an empty name', () => {
    expect(isAlreadyPresent('   ', list)).toBe(false);
    expect(isAlreadyPresent('', [])).toBe(false);
  });
});
