/**
 * Which lists start open on a trip screen, and how an explicit toggle overrides that.
 *
 * Backed by `profiles.listPrefs` (see instant.schema.ts), which stores ONLY the lists the
 * user has genuinely toggled. Everything untouched keeps following the default below, so
 * changing that default later doesn't have to fight a database full of stale values.
 *
 * On the profile rather than device storage because the choice is about the person, not the
 * phone: opening Walker's list on the iPad and finding it closed would be a bug.
 */

export type ListPrefs = Record<string, boolean>;

/**
 * The rule when the user has never touched a list: mine and the shared list are open,
 * everyone else's is closed.
 *
 * Closed is not hidden — a collapsed header still reports its own progress count, so another
 * person's list can be checked at a glance without being scrolled past every time.
 *
 * @param ownerPersonId the list's owner, or undefined for the shared list
 * @param myPersonId the person linked to the signed-in profile
 */
export function defaultExpanded(ownerPersonId?: string, myPersonId?: string): boolean {
  return !ownerPersonId || ownerPersonId === myPersonId;
}

/**
 * Resolves a list's open state: explicit override first, default second.
 *
 * @param prefs the profile's stored overrides, or undefined before it loads
 */
export function isExpanded(
  listId: string,
  ownerPersonId: string | undefined,
  myPersonId: string | undefined,
  prefs?: ListPrefs,
): boolean {
  const override = prefs?.[listId];
  return typeof override === 'boolean' ? override : defaultExpanded(ownerPersonId, myPersonId);
}

/**
 * Next value for `profiles.listPrefs` after a toggle.
 *
 * Deliberately DELETES the key when the new state matches the default instead of writing it.
 * Collapsing your own list is a real preference worth remembering; collapsing it and then
 * reopening it is just returning to normal, and shouldn't pin that list forever.
 */
export function withExpanded(
  prefs: ListPrefs | undefined,
  listId: string,
  expanded: boolean,
  ownerPersonId?: string,
  myPersonId?: string,
): ListPrefs {
  const next: ListPrefs = { ...(prefs ?? {}) };
  if (expanded === defaultExpanded(ownerPersonId, myPersonId)) delete next[listId];
  else next[listId] = expanded;
  return next;
}

/** `i.json()` comes back as unknown; narrow it without trusting the shape. */
export function parseListPrefs(raw: unknown): ListPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ListPrefs = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}
