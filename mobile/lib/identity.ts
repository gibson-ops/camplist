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
