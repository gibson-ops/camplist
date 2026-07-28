import { rankTrips, type TripRow, type TripShape } from './similarity';
import { slugify } from './tripMeta';
import type { ItemSeed } from './itemSeeds';

/**
 * Turning what happened on a trip into what to suggest for the next one.
 *
 * This is the half of the loop history cannot do on its own. History can only ever suggest what
 * you've packed before — it is structurally incapable of learning from what you FORGOT, because
 * a thing you forgot left no trace on any list. The post-trip note is the only input that can add
 * something genuinely new, which is what makes it higher-leverage than the engine it feeds.
 *
 * A reflection is a DISAMBIGUATION, not a journal. The app finishes every trip holding one fact
 * it can't interpret — items that were on the list and never got ticked — and that fact means
 * four different things, two of which point the opposite way from the other two. See
 * `instant.schema.ts`.
 */

/** A stored reflection, as it comes back from the query. */
export type ReflectionRow = {
  kind: string;
  /** What it's about when there's no item to link to — `wished_had` above all. */
  name?: string;
  item?: { name: string } | null;
  trip?: { id: string } | null;
};

/**
 * Which way each kind of note pushes.
 *
 * `mistracked` is deliberately absent, and it's the most important entry in the table by its
 * absence: "it went in the car, nobody ticked it" is a fact about the CHECKBOX, not about the
 * item. Treating it as a signal either way would teach the app from the user's own admin
 * failure — and since it's probably the most common answer of the four, doing that would drown
 * everything the other three say.
 */
const VERDICT: Record<string, 'up' | 'down'> = {
  // Said out loud that it was needed. The strongest signal the product has, and the only one
  // that can name something no list has ever held.
  wished_had: 'up',
  // Was on the list, should have come, didn't. History already knows the item; this says louder.
  forgot: 'up',
  // Brought it and never touched it.
  didnt_need: 'down',
  // Deliberately left home. Demote, and do NOT flag it as a failure — it was a decision.
  skipped: 'down',
  // Wasn't relevant to a trip of this shape.
  didnt_fit: 'down',
};

export type Verdicts = {
  /** Lead the list. Carries a full seed because a `wished_had` may exist nowhere else. */
  promoted: ItemSeed[];
  /** Sink to the back of the list, behind everything else. See why below. */
  demoted: string[];
};

/**
 * What past reflections say about the trip being packed.
 *
 * SCOPED BY SHAPE, which is the rule that makes reflections safe to act on at all. "Didn't need
 * camp chairs" said after a backpacking trip must not take chairs off a car-camping list — the
 * note was true and the inference from it would be wrong. Every reflection is therefore weighted
 * by how much ITS trip resembles this one, through the same matcher everything else uses, and a
 * note from a trip that doesn't clear the floor is simply not evidence here.
 *
 * Demotion SINKS rather than silences. A sunk suggestion still appears whenever the budget has
 * room and only falls off when something better needs the slot; a silenced one is gone at any
 * budget. That's the right weight for one observation from one trip — enough to lose an argument
 * with better evidence, not enough to win one alone. Silencing is reserved for a suggestion
 * turned down twice, which is a more deliberate act; see `dismissedNames`.
 *
 * @param reflections every reflection in the household, each with its trip
 * @param current the trip being packed
 * @param past every other trip in the household, for scoring where each note came from
 * @param now injectable so the tests aren't calendar-dependent
 */
export function verdictsFrom({
  reflections,
  current,
  past,
  now = Date.now(),
}: {
  reflections: ReflectionRow[];
  current: TripShape;
  past: TripRow[];
  now?: number;
}): Verdicts {
  const weightOf = new Map(rankTrips(current, past, now).map((t) => [t.shape.id, t.weight]));

  const up = new Map<string, { name: string; weight: number; order: number }>();
  const down = new Map<string, { name: string; weight: number; order: number }>();
  let order = 0;

  for (const reflection of reflections) {
    const direction = VERDICT[reflection.kind];
    if (!direction) continue;

    const name = reflection.name ?? reflection.item?.name;
    const key = name ? slugify(name) : '';
    if (!key) continue;

    // A note from a trip that isn't like this one carries no weight here. Notes with no trip at
    // all are dropped for the same reason: unscoped, they'd apply everywhere.
    const weight = reflection.trip ? weightOf.get(reflection.trip.id) : undefined;
    if (!weight) continue;

    const bucket = direction === 'up' ? up : down;
    const existing = bucket.get(key);
    if (existing) existing.weight += weight;
    else bucket.set(key, { name: name as string, weight, order: order++ });
  }

  const ranked = (bucket: typeof up) =>
    [...bucket.values()].sort((a, b) => b.weight - a.weight || a.order - b.order);

  return {
    // Nothing says whether a wished-for thing is shared or personal, and 'one' is the safer
    // guess: it puts the row on the shared list, where everyone sees it, instead of quietly
    // copying it onto every person's.
    promoted: ranked(up).map((entry) => ({ name: entry.name, sharing: 'one' as const })),
    demoted: ranked(down).map((entry) => entry.name),
  };
}

/**
 * Items on a finished trip that were never ticked, which is the one question worth asking.
 *
 * Everything else the app can answer for itself, and asking a question you already know the
 * answer to is how a post-trip prompt turns into a chore nobody finishes.
 */
export function needsAnswer(
  lists: { items?: { id: string; name: string; state?: string; group?: { id: string } | null }[] }[],
): { id: string; name: string }[] {
  return lists.flatMap((list) =>
    (list.items ?? [])
      .filter((item) => (item.state ?? 'unpacked') === 'unpacked' && !item.group)
      .map((item) => ({ id: item.id, name: item.name })),
  );
}

/**
 * Whether a trip is over and worth asking about.
 *
 * Reads the return date, then the departure date, and gives up rather than guessing. An undated
 * trip is never finished as far as this is concerned — prompting for reflections on a trip that
 * might not have happened yet is worse than never prompting at all.
 */
export function isFinished(
  trip: { departAt?: Date | string | number | null; returnAt?: Date | string | number | null },
  now: number = Date.now(),
): boolean {
  const end = trip.returnAt ?? trip.departAt;
  if (end === null || end === undefined) return false;

  const ms = +new Date(end);
  return !Number.isNaN(ms) && ms < now;
}
