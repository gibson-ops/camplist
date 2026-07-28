import { formatDateRange, toCalendarDate } from './tripMeta';

export type Range = { departAt: Date | null; returnAt: Date | null };

/**
 * The three rules a trip's date range obeys, in one place.
 *
 * They were written twice — once in the native picker, once in the web one — which is two
 * chances to drift and no way to test either. Worse, the pickers were the ONLY thing enforcing
 * them: `min` on an `<input type="date">` and `minimumDate` on a native picker constrain what
 * the widget will offer, not what can be stored. A desktop browser will happily let someone
 * type an earlier date straight into the field, and an invalid input still fires a change.
 *
 * An inverted range doesn't crash anything, which is what makes it worth guarding. It
 * degrades quietly: `formatDateRange` falls back to showing the departure alone, and the seed
 * rule that watches trip length reads no nights at all, so "No laundry" silently stops being
 * offered on a fortnight away.
 *
 * @param current the range as stored
 * @param which which end the user just touched
 * @param picked the day they chose, or null if they cleared it
 */
export function nextRange(current: Range, which: 'depart' | 'return', picked: Date | null): Range {
  const day = picked ? toCalendarDate(picked) : null;

  if (which === 'depart') {
    // Clearing departure clears return with it. A return with nothing to return from is not
    // half a range, it's nothing: nothing derives from it and nothing displays it.
    if (!day) return { departAt: null, returnAt: null };

    // Moving departure past the return would invert the range. Drop the stale end rather than
    // silently showing "Sep 8–4".
    const keep = current.returnAt && +current.returnAt >= +day ? current.returnAt : null;
    return { departAt: day, returnAt: keep };
  }

  // A return before the departure is rejected outright rather than clamped. Clamping would
  // quietly record a day they didn't choose; refusing leaves the field as it was, which is
  // what the picker's own minimum was already telling them.
  if (day && current.departAt && +day < +current.departAt) return current;

  return { departAt: current.departAt, returnAt: day };
}

/**
 * Why a pick is going to be refused, in words a field can show.
 *
 * `nextRange` refusing quietly is worse than it sounds: the picker's own minimum doesn't always
 * grey out the days it should — a wheel-style mobile picker will happily let you land on one —
 * so a silent refusal reads as the app ignoring you. Saying what's wrong costs a line.
 *
 * @returns the message, or undefined when the pick is fine
 */
export function rangeProblem(
  range: Range,
  which: 'depart' | 'return',
  picked: Date | null,
): string | undefined {
  if (which !== 'return' || !picked || !range.departAt) return undefined;
  if (+toCalendarDate(picked) >= +range.departAt) return undefined;

  return `Can't be before ${formatDateRange(range.departAt)}.`;
}
