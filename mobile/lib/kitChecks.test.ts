import { isContentChecked, outstandingChecks } from './kitChecks';

describe('isContentChecked', () => {
  /**
   * The default that makes "all green" mean something. A spatula is in the box — that is what the
   * box is for — so it does not wait on anybody.
   */
  it('counts something that needs no verifying as good without being told', () => {
    expect(isContentChecked({ consumable: false })).toBe(true);
    expect(isContentChecked({})).toBe(true);
  });

  it('holds something that needs a look until it gets one', () => {
    expect(isContentChecked({ consumable: true })).toBe(false);
  });

  it('takes an explicit answer over the default, in either direction', () => {
    expect(isContentChecked({ consumable: true, checked: true })).toBe(true);
    expect(isContentChecked({ consumable: false, checked: false })).toBe(false);
  });

  /**
   * THE REASON THE CHECK IS ITS OWN FIELD. Stored on `state`, an untouched spatula and one
   * deliberately flagged for a look are both `unpacked` — the same value for opposite answers. So
   * unticking something that usually needs nothing has to be recordable, or it silently re-greens.
   */
  it('lets you flag something that usually needs nothing', () => {
    expect(isContentChecked({ consumable: false, checked: false })).toBe(false);
  });

  /** Contents ticked before `checked` existed keep their tick, which is what avoids a migration. */
  it('honors a tick left by the old three-state cycle', () => {
    expect(isContentChecked({ consumable: true, state: 'packed' })).toBe(true);
    expect(isContentChecked({ consumable: true, state: 'loaded' })).toBe(true);
    expect(isContentChecked({ consumable: true, state: 'unpacked' })).toBe(false);
  });

  it('still lets an explicit answer overrule that leftover state', () => {
    expect(isContentChecked({ consumable: true, state: 'loaded', checked: false })).toBe(false);
  });
});

describe('outstandingChecks', () => {
  it('counts only what is still waiting on you', () => {
    expect(
      outstandingChecks([
        { consumable: false },
        { consumable: true, checked: true },
        { consumable: true },
        { consumable: false, checked: false },
      ]),
    ).toBe(2);
  });

  it('is zero for a kit that is all green', () => {
    expect(outstandingChecks([{ consumable: false }, { consumable: true, checked: true }])).toBe(0);
    expect(outstandingChecks([])).toBe(0);
  });
});
