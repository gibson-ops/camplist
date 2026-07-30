/** Just enough of a kit's content to say whether it is good to go. */
export type CheckableContent = {
  /** Whether anything about it needs verifying. See lib/checkReasons.ts. */
  consumable?: boolean;
  /** The recorded answer, once somebody has given one either way. */
  checked?: boolean | null;
  /**
   * What the old three-state cycle left behind, for contents that predate `checked`.
   *
   * Typed loosely because it arrives straight off a query, where it is a plain string. Only
   * "is it something other than unpacked" is read from it.
   */
  state?: string | null;
};

/**
 * Whether a kit's content counts as good to go.
 *
 * EVERY CONTENT HAS A CHECKBOX, and every one of them can be toggled. Things that need no
 * verifying start green — a spatula is in the box, that is what the box is for — but they are not
 * frozen, because "sometimes I want to mark an item that doesn't usually need checking as needing
 * to be checked" is a real thing to want, it costs nothing to allow, and a row you cannot touch
 * next to rows you can is the inconsistency. What you are looking for is all green down the list.
 *
 * The answer is taken in order of how much it is worth:
 *
 *   1. `checked` — somebody said so explicitly. Always wins, in either direction.
 *   2. the old `state` — a content ticked before `checked` existed keeps its tick.
 *   3. `consumable` — nothing needs verifying, so it is good without anybody saying so.
 *
 * That chain is why this needed no migration. It is also why the check is its own field rather
 * than more meaning piled onto `state`: stored as `unpacked`, untouched-and-fine and
 * deliberately-flagged are the same value, and those are opposite answers.
 */
export function isContentChecked(content: CheckableContent): boolean {
  if (typeof content.checked === 'boolean') return content.checked;
  if (content.state && content.state !== 'unpacked') return true;
  return !content.consumable;
}

/** How many of a kit's contents are still waiting on you. Zero means all green. */
export function outstandingChecks(contents: CheckableContent[]): number {
  return contents.filter((content) => !isContentChecked(content)).length;
}
