import { itemKey } from './itemKey';
import { reasonOf, type CheckReason } from './checkReasons';

/**
 * What a kit contained last time you took it.
 *
 * THE LAST TRIP IS THE TEMPLATE. The schema has a proper one — `itemGroups` holds a reusable kit
 * and `groupItems` its roster — and `groupItems` is written by nothing, because promoting a trip's
 * contents into a template needs a rule for when that promotion is earned ("one trip where you
 * left the skillet home shouldn't rewrite the box", per `addKit`). That rule is real work and it
 * was never done, so kits have been effectively per-trip: you build the camp kitchen, and next
 * trip you build it again.
 *
 * Reading the most recent instance skips the whole problem. It needs no new data, no template
 * editor, and no promotion rule, and it is the same answer a template would have given for every
 * kit that has not changed since last time — which is most of them.
 *
 * "JUST THIS TRIP" IS WHAT SEPARATES A MEMBER FROM A PASSENGER. A kit's contents are two different
 * kinds of thing: what belongs in the box, and what rode along once. `oneOff` already draws that
 * line, it is already offered when editing any row, and it already means exactly this — so the box
 * comes back with its members and without the wedding gift.
 *
 * Distinct from `itemNames.ts`, which is a vocabulary of NAMES and deliberately excludes kit rows:
 * offering a kit as a plain name would produce an empty box that reads as handled. A kit is only
 * worth offering with its contents attached, which is what this provides.
 */

export type KitContent = {
  name: string;
  /** Whether it needs a look before the kit counts as packed. */
  consumable: boolean;
  /** What to look for, carried through so a re-made kit still says "stocked?" rather than nothing. */
  checkReason?: CheckReason;
};

export type KitTemplate = {
  /** The kit's name, spelled as the most recent trip spelled it. */
  name: string;
  /** `itemKey(name)`, so callers can match it against what is already on the trip. */
  key: string;
  contents: KitContent[];
  /** The trip it was read from — what lets an offer say where it came from. */
  from: string;
  /** How many trips have carried a kit by this name. */
  trips: number;
};

/**
 * A trip with enough loaded to find its kits and read what was in them.
 *
 * Declared here rather than reusing `PackedTripRow`, which deliberately does not carry `children`:
 * `itemHistory` never looks inside a kit, and widening its type to serve this would make every
 * caller of the matcher fetch contents it has no use for.
 */
export type KittedTrip = {
  name?: string;
  departAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  lists?: {
    items?: {
      name: string;
      /** Present on a kit row. The definition of a kit — not "has children". */
      group?: { id: string } | null;
      children?: {
        name: string;
        consumable?: boolean;
        checkReason?: string | null;
        /** "Just this trip" — rode along once, so it is not a member of the box. */
        oneOff?: boolean;
      }[];
    }[];
  }[];
};

/** Departure if it has one, creation otherwise — the same reading `shapeOf` uses for recency. */
function when(trip: KittedTrip): number {
  const at = trip.departAt ?? trip.createdAt;
  const ms = at ? +new Date(at as string) : NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Every kit the household has taken, with the contents it had most recently.
 *
 * @param trips past trips with lists, items, `group` and `children` loaded
 * @param skip  kits already on the trip being packed, by `itemKey`. A kit you already have is not
 *              an offer, and the add sheet's duplicate guard works on names rather than kits
 */
export function kitsFromHistory(trips: KittedTrip[], skip: Set<string> = new Set()): KitTemplate[] {
  // Newest first, so the first instance of a name encountered is the one to copy.
  const byRecency = [...trips].sort((a, b) => when(b) - when(a));

  const found = new Map<string, KitTemplate>();

  for (const trip of byRecency) {
    for (const list of trip.lists ?? []) {
      for (const item of list.items ?? []) {
        // A kit row is the one carrying a group link. Everything else is a thing.
        if (!item.group) continue;

        const key = itemKey(item.name);
        if (!key || skip.has(key)) continue;

        const existing = found.get(key);
        if (existing) {
          // Older instance of a kit already captured: it still counts toward how established the
          // kit is, but its contents lose to the newer ones.
          existing.trips += 1;
          continue;
        }

        const contents: KitContent[] = [];
        for (const child of item.children ?? []) {
          // Rode along once. See the header: this is the whole member/passenger distinction.
          if (child.oneOff) continue;
          if (!itemKey(child.name)) continue;

          contents.push({
            name: child.name.trim(),
            consumable: Boolean(child.consumable),
            // Through `reasonOf`, the one place that decides what a stored row MEANS — it maps a
            // retired spelling onto its replacement and fills the default for a consumable that
            // never said. Reading the column raw would be a second opinion on the same question.
            checkReason: reasonOf(child)?.value,
          });
        }

        // An empty box is the thing this feature exists to avoid offering. A kit whose contents
        // were all one-offs, or which was never filled, has nothing to bring.
        if (!contents.length) continue;

        found.set(key, {
          name: item.name.trim(),
          key,
          contents,
          from: trip.name ?? '',
          trips: 1,
        });
      }
    }
  }

  // Most-carried first: a box taken on every trip is a better offer than one taken once.
  return [...found.values()].sort(
    (a, b) => b.trips - a.trips || b.contents.length - a.contents.length,
  );
}
