import { accountLabel, initialsOf } from './identity';

describe('initialsOf', () => {
  it('takes the first letter of the first and last words', () => {
    expect(initialsOf('Jared Gibson')).toBe('JG');
  });

  /** A four-letter monogram stops being readable well before it stops being accurate. */
  it('never returns more than two letters, however many names there are', () => {
    expect(initialsOf('Mary Anne van der Berg')).toBe('MB');
  });

  it('handles a single name', () => {
    expect(initialsOf('Walker')).toBe('W');
  });

  it('is not confused by extra whitespace', () => {
    expect(initialsOf('  Jared   Gibson  ')).toBe('JG');
  });

  it('uppercases whatever it finds', () => {
    expect(initialsOf('jared gibson')).toBe('JG');
  });

  /**
   * The generic glyph is the honest answer for anything that would produce a meaningless mark —
   * and it's also the one that keeps saying the account isn't finished.
   */
  it('gives up rather than showing a meaningless mark', () => {
    expect(initialsOf('')).toBeUndefined();
    expect(initialsOf('   ')).toBeUndefined();
    expect(initialsOf(undefined)).toBeUndefined();
    expect(initialsOf(null)).toBeUndefined();
    expect(initialsOf('🏕️')).toBeUndefined();
  });

  it('skips punctuation to find a real letter', () => {
    expect(initialsOf('"Bear" Gibson')).toBe('BG');
    expect(initialsOf('🏕️ Camp Crew')).toBe('CC');
  });

  it('reads names that are not written in Latin script', () => {
    expect(initialsOf('Ана Петрова')).toBe('АП');
  });
});

describe('accountLabel', () => {
  /**
   * The profile name is "Me" until somebody changes it, and "Me" doesn't say WHICH account you
   * are signed into — the only question this line exists to answer.
   */
  it('prefers the email, because the name is usually still Me', () => {
    expect(accountLabel({ email: 'a@b.com', name: 'Me', isGuest: false })).toBe('a@b.com');
  });

  it('says plainly when there is no account yet', () => {
    expect(accountLabel({ name: 'Me', isGuest: true })).toBe('Not signed in');
  });

  it('falls back to the name for a signed-in account with no email on the profile', () => {
    expect(accountLabel({ name: 'Jared', isGuest: false })).toBe('Jared');
  });

  it('never renders an empty line', () => {
    expect(accountLabel({ name: '   ', isGuest: false })).toBe('Signed in');
  });
});
