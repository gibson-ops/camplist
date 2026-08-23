import { itemKey } from './itemKey';

/**
 * Where a name already sits on this trip — the half of duplicate protection the Add button
 * cannot do.
 *
 * The button blocks on the DESTINATION, and that is right: "Matches" in the camp kitchen and
 * "Matches" on the shared list are different places, and a second one is a decision you are
 * allowed to make. But the duplicate that actually gets made is the one you cannot see, and a kit
 * hides its contents behind a collapsed row. Knowing the matches are already in the camp kitchen
 * is what stops the second box of them, and nothing in the sheet knew it.
 *
 * So this answers a deliberately weaker question than `isAlreadyPresent`: not "may I add this?"
 * but "do you already have one, and where?".
 */

/** A trip's lists, with enough loaded to say what is on them and what is inside their kits. */
export type PlacedList = {
  id: string;
  name: string;
  items?: {
    id: string;
    name: string;
    /** A kit's contents, which live under the row rather than on the list. */
    children?: { name: string }[];
  }[];
};

export type Place = {
  /** `itemKey(name)`, matching the corpus and the duplicate guard. */
  key: string;
  /** The container it is in — a list's name, or a kit's. Shown to the user as written. */
  where: string;
};

/**
 * Every name on the trip and the container holding it, EXCEPT the one being added to.
 *
 * Skipping the destination is what keeps this from contradicting the Add button. Something
 * already in the place you are adding to is the button's business and it says so there; this is
 * only ever about somewhere else.
 *
 * Where a name sits in more than one place the first is reported, in the order the lists and
 * items were given — so pass them already sorted, as the trip screen does. One container is
 * enough to make the point, and "in 2 places" is a sentence nobody needed.
 *
 * @param lists the trip's lists, in display order, each with its items in display order
 * @param skip the destination. `listId` when adding to a list, `parentId` when adding into a kit
 */
export function placesOnTrip(
  lists: PlacedList[],
  skip: { listId?: string; parentId?: string } = {},
): Place[] {
  const found = new Map<string, string>();

  const record = (name: string, where: string) => {
    const key = itemKey(name);
    if (!key || found.has(key)) return;
    found.set(key, where);
  };

  for (const list of lists) {
    for (const item of list.items ?? []) {
      // A kit ROW is a name on the list like any other — typing "camp kitchen" when one already
      // exists is exactly the duplicate worth catching.
      if (list.id !== skip.listId) record(item.name, list.name);

      // Contents are held by the KIT, not by the list under it. That is the whole point: they are
      // on the trip and invisible from here.
      if (item.id !== skip.parentId) {
        for (const child of item.children ?? []) record(child.name, item.name);
      }
    }
  }

  return [...found.entries()].map(([key, where]) => ({ key, where }));
}
