import { CHECK_REASONS, checkPrompt, reasonOf } from './checkReasons';

describe('reasonOf', () => {
  it('says nothing about an item that is not checked', () => {
    expect(reasonOf({ consumable: false, checkReason: 'charged' })).toBeUndefined();
    expect(reasonOf({})).toBeUndefined();
  });

  it('reads the recorded reason', () => {
    expect(reasonOf({ consumable: true, checkReason: 'charged' })?.ask).toBe('charged?');
  });

  /**
   * THE COMPATIBILITY RULE. Every item marked `consumable` before this field existed has no reason
   * on it, and depletion is what `consumable` has always meant — so those items keep behaving
   * exactly as they did rather than losing their prompt.
   */
  it('falls back to depletion for an item that predates the field', () => {
    expect(reasonOf({ consumable: true })?.value).toBe('empty');
    expect(reasonOf({ consumable: true, checkReason: null })?.value).toBe('empty');
  });

  /** A value from a newer client, or a typo, must not blank the check. */
  it('falls back rather than showing nothing for an unknown reason', () => {
    expect(reasonOf({ consumable: true, checkReason: 'levitating' })?.value).toBe('empty');
  });
});

describe('checkPrompt', () => {
  it('asks a question rather than naming a property', () => {
    // The distinction the fields exist for: you pick "Needs washing", you get asked "clean?".
    expect(checkPrompt({ consumable: true, checkReason: 'clean' })).toBe('clean?');
    expect(CHECK_REASONS.find((r) => r.value === 'clean')?.label).toBe('Needs washing');
  });

  /**
   * A row that still asks after you have answered it reads as not having heard you. So the same
   * fact is a question while open and a statement once confirmed.
   */
  it('states the fact once the check is answered', () => {
    expect(checkPrompt({ consumable: true, checkReason: 'charged' }, true)).toBe('charged');
    expect(checkPrompt({ consumable: true, checkReason: 'charged' }, false)).toBe('charged?');
  });

  it('has nothing to ask about an unchecked item', () => {
    expect(checkPrompt({ consumable: false })).toBeUndefined();
    expect(checkPrompt({ consumable: false }, true)).toBeUndefined();
  });
});

describe('CHECK_REASONS', () => {
  it('offers all three wordings for every reason, and no duplicates', () => {
    for (const entry of CHECK_REASONS) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.ask.endsWith('?')).toBe(true);
      // The answered form is the same fact asserted, so it must not still be asking.
      expect(entry.done.endsWith('?')).toBe(false);
      expect(entry.done.length).toBeGreaterThan(0);
    }
    expect(new Set(CHECK_REASONS.map((r) => r.value)).size).toBe(CHECK_REASONS.length);
  });

  /** Asks whether it still has life in it, rather than asserting it needs replacing. */
  it('words wear as a question about condition', () => {
    const wear = CHECK_REASONS.find((r) => r.value === 'replace');
    expect(wear?.label).toBe('Wears out');
    expect(wear?.ask).toBe('still good?');
  });

  it('covers the conditions Jared named, including replacement', () => {
    const values = CHECK_REASONS.map((r) => r.value);
    expect(values).toEqual(
      expect.arrayContaining(['empty', 'charged', 'clean', 'serviced', 'expired', 'replace']),
    );
  });

  /**
   * Presence leads because it is the most common reason a kit needs opening at all — the things
   * that leave it are the things you forget. Depletion is still the DEFAULT for an item with no
   * reason recorded, which is a different question and covered by `reasonOf`.
   */
  it('leads with presence, the reason a kit gets opened at all', () => {
    expect(CHECK_REASONS[0].value).toBe('present');
  });

  it('still covers presence among the conditions', () => {
    expect(CHECK_REASONS.map((r) => r.value)).toContain('present');
  });
});
