/**
 * How an account presents itself: what it's called, and what goes in the avatar.
 *
 * The avatar is the only place in the app that reports whether an account is finished, and it
 * does it by CHANGING SHAPE rather than by wearing a badge. A generic glyph means there's still
 * something to do; initials or a picture mean it's yours. That's a nudge nobody has to dismiss,
 * and it gives finishing an actual reward — your own initials, where a stranger's outline was.
 */

/**
 * Initials for the avatar, or undefined when there's nothing worth showing.
 *
 * TWO LETTERS AT MOST, and only from the first and last words: "Jared Gibson" is JG, and
 * "Mary Anne van der Berg" is MB rather than MAVDB. A four-letter monogram doesn't fit a 32px
 * circle and stops being readable well before it stops being accurate.
 *
 * Returns undefined rather than a placeholder for anything that would produce a meaningless
 * mark — the generic glyph is the honest answer there, and it's also the one that keeps saying
 * "this isn't finished".
 *
 * @param name the person's display name, however they typed it
 * @returns 1–2 uppercase letters, or undefined when the name yields none
 */
export function initialsOf(name?: string | null): string | undefined {
  if (!name) return undefined;

  // Letters and digits only: emoji, punctuation and stray symbols make an unreadable monogram.
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => [...word].find((ch) => /\p{L}|\p{N}/u.test(ch)))
    .filter((ch): ch is string => Boolean(ch));

  if (!words.length) return undefined;
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return letters.join('').toUpperCase();
}

/**
 * Names that aren't names: what the app wrote before the user chose anything.
 *
 * `profiles.name` is bootstrapped to "Me", which is exactly right for the PERSON row in a
 * household list — it's a self label, the "mine" in "my list" — and exactly wrong as an account
 * name. Deriving an avatar from it stamps a confident "M" on every account in existence, which
 * looks like an identity and carries none.
 */
const PLACEHOLDER_NAMES = new Set(['me']);

/**
 * The mark for the avatar, or undefined when a generic glyph is the honest answer.
 *
 * Falls back to the EMAIL rather than to the placeholder name, because the email is the only
 * thing the user actually supplied. One letter from it is thin, but it's true — and it differs
 * between accounts, which "M" for everybody does not.
 *
 * A guest gets nothing at all: there is no account yet, and the empty outline is what says so.
 *
 * @param name the profile name, which is a placeholder until somebody changes it
 * @param email the address they signed in with
 */
export function accountInitials({
  name,
  email,
  isGuest,
}: {
  name?: string | null;
  email?: string | null;
  isGuest: boolean;
}): string | undefined {
  if (isGuest) return undefined;

  const chosen = name?.trim();
  if (chosen && !PLACEHOLDER_NAMES.has(chosen.toLowerCase())) {
    const initials = initialsOf(chosen);
    if (initials) return initials;
  }

  // The local part only — the letter after the @ belongs to the mail provider, not the person.
  const local = email?.trim().split('@')[0];
  return local ? initialsOf(local.replace(/[._-]+/g, ' ')) : undefined;
}

/**
 * What the account is called, in the one place it's read back to the user.
 *
 * Prefers the email over the profile name once there is one, because the name is "Me" until
 * somebody changes it and "Me" tells you nothing about WHICH account you're signed into — which
 * is the entire question this line exists to answer, especially with two households in play
 * after a merge.
 */
export function accountLabel({
  email,
  name,
  isGuest,
}: {
  email?: string | null;
  name?: string | null;
  isGuest: boolean;
}): string {
  if (email) return email;
  if (isGuest) return 'Not signed in';
  return name?.trim() || 'Signed in';
}
