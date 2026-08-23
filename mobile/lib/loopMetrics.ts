import { suggestFor } from './suggest';
import { dismissedNames, SUGGESTION_BUDGET } from './itemSeeds';
import { verdictsFrom } from './reflections';
import { shapeOf } from './similarity';
import { slugify } from './tripMeta';
import type { PackedTripRow } from './itemHistory';

/**
 * Did the app know what you were going to need?
 *
 * A REPLAY, NOT A DASHBOARD, and the difference is what makes it worth building. Suggestions are
 * computed on demand and never stored, so there is no record of what was offered for a past trip.
 * But `suggestFor` is a pure function of the history, so what it WOULD have said can be recomputed
 * from what existed at the time — which means the same replay can be run again after changing the
 * matcher and the numbers compared. It is a regression test for the learning loop, not a readout.
 *
 * That is the point. Every idea in `docs/learning-loop-plan.md` — weight the people coming more
 * heavily, split the truck from the commuter — is a change that will FEEL right and ship and never
 * be checked. This is the thing it gets checked against.
 *
 * THE NUMBER THAT MATTERS IS `missed`. The app exists to stop you forgetting, so anything you had
 * to remember unaided is the gap it was built to close. `ignored` is the counterweight: driving
 * misses to zero by suggesting everything is the failure that makes a list stop being read.
 */

export type TripReplay = {
  tripId: string;
  name: string;
  /** On the final list, and the app would have offered it. */
  taken: string[];
  /** On the final list, and the app would not have. THE HEADLINE FAILURE. */
  missed: string[];
  /** Offered, and never went on the list. */
  ignored: string[];
  /**
   * The part of `missed` that is a kit rather than a thing.
   *
   * Broken out because it is a KNOWN STRUCTURAL GAP rather than a matcher failure: history skips
   * kit rows on purpose, since suggesting one as a plain item produces an empty "Camp kitchen"
   * that reads as handled. Counting these silently would blame the matcher for a feature nobody
   * has built — see "Kits from history" in ROADMAP.md.
   */
  kits: string[];
  /**
   * The part of `missed` marked never-suggest-again.
   *
   * Also not a matcher failure: a one-off is a thing that trip needed and no future trip will, so
   * the app was right not to know it. Left inside `missed` because you still had to think of it.
   */
  oneOffs: string[];
  /** What somebody said afterwards they had wanted — ground truth, from a person rather than a guess. */
  regrets: string[];
  /** `taken / (taken + missed)`, or null when the trip listed nothing to judge. */
  coverage: number | null;
};

type ReplayTrip = PackedTripRow & {
  name: string;
  createdAt: Date | string | number;
};

/** Matches `ReflectionRow` so the same rows can go straight to `verdictsFrom`. */
type Reflection = {
  kind: string;
  name?: string;
  item?: { name: string } | null;
  trip?: { id: string } | null;
};

/** Top-level rows only — a kit's contents are about stocking a box, not about what this trip needs. */
function listedOn(trip: PackedTripRow) {
  return (trip.lists ?? []).flatMap((list) => list.items ?? []);
}

/**
 * The rows worth judging: the ones that were actually packed.
 *
 * WRITING SOMETHING DOWN IS NOT NEEDING IT. A row that stayed `unpacked` is evidence of nothing in
 * either direction — not a hit if the app named it, not a miss if it didn't — so counting it makes
 * the score a measure of list-building rather than of packing.
 *
 * This is what stops the replay grading the app against a copy of its own answers. A trip whose
 * list was built by accepting suggestions scores 100% by construction, and every later change to
 * the matcher then reads as a regression against it. Measured: one such trip sat at 30/30 and
 * dragged the total below a change that plainly improved the only trip that had actually happened.
 *
 * A trip still being packed therefore has no verdict yet, which is correct — it has not happened.
 */
function packedOn(trip: PackedTripRow) {
  return listedOn(trip).filter((item) => item.state && item.state !== 'unpacked');
}

/**
 * What the app would have suggested for one trip, against what actually went on it.
 *
 * @param trip the trip to judge
 * @param past every trip that EXISTED WHEN THIS ONE WAS CREATED. Passing later trips would let the
 *             app answer with things it could not have known, which is the one way a replay can
 *             flatter itself
 * @param reflections notes from those earlier trips, for the same reason
 * @param limit how many suggestions to count as "offered". Defaults to the review screen's budget,
 *              because that is the surface where a trip's list actually gets built — a suggestion
 *              ranked below the budget was never shown, so counting it would score the app on
 *              things you never saw
 */
export function replayTrip({
  trip,
  past,
  reflections = [],
  limit = SUGGESTION_BUDGET.review,
}: {
  trip: ReplayTrip;
  past: ReplayTrip[];
  reflections?: Reflection[];
  limit?: number;
}): TripReplay {
  // As-of, not now: recency is part of the ranking, so judging a two-year-old trip against today's
  // clock would rank its own history as stale in a way it never was at the time.
  const asOf = +new Date(trip.createdAt);

  /**
   * Notes from OTHER trips, which is the only kind the app could have read beforehand.
   *
   * Filtered here rather than by the caller on purpose: the one way this measurement can lie is by
   * flattering itself, so the cut lives next to the code that must not break it.
   *
   * THE REACHABLE LEAK IS DISMISSALS. `dismissedNames` silences a name as soon as its own trip has
   * turned it down, so feeding this trip's notes back in makes the replay conclude the hammock was
   * never offered — when what happened is that it was offered and you said no. The offer would
   * vanish from the score instead of counting as noise, which is the app marking its own homework.
   *
   * `verdictsFrom` cannot leak the same way, because it only credits a note whose trip is in
   * `past`, and the trip being judged never is. The filter covers it anyway rather than relying on
   * a guarantee that lives in another module and could be relaxed there without anyone noticing.
   */
  const before = reflections.filter((r) => r.trip?.id !== trip.id);

  const offered = suggestFor({
    trip,
    past,
    // Nothing was on it yet. The exclusion exists to stop the screen offering what you already
    // wrote down, and at creation you had written nothing.
    onList: [],
    dismissed: dismissedNames(
      before.map((r) => ({ name: r.name, trip: r.trip ?? undefined })),
      trip.id,
    ),
    verdicts: verdictsFrom({ reflections: before, current: shapeOf(trip, asOf), past }),
    limit,
    now: asOf,
  });

  const offeredKeys = new Set(offered.map((seed) => slugify(seed.name)));
  // Judged on what was packed; `ignored` still measured against the WHOLE list, since something
  // written down was not ignored even if it never made it into the car.
  const listed = packedOn(trip);
  const listedKeys = new Set(
    listedOn(trip)
      .map((item) => slugify(item.name))
      .filter(Boolean),
  );

  const taken: string[] = [];
  const missed: string[] = [];
  const kits: string[] = [];
  const oneOffs: string[] = [];

  for (const item of listed) {
    const key = slugify(item.name);
    if (!key) continue;

    if (offeredKeys.has(key)) {
      taken.push(item.name);
      continue;
    }

    missed.push(item.name);
    if (item.group) kits.push(item.name);
    if (item.oneOff) oneOffs.push(item.name);
  }

  const judged = taken.length + missed.length;

  return {
    tripId: trip.id,
    name: trip.name,
    taken,
    missed,
    ignored: offered.map((seed) => seed.name).filter((name) => !listedKeys.has(slugify(name))),
    kits,
    oneOffs,
    regrets: reflections
      .filter((r) => r.trip?.id === trip.id && (r.kind === 'wished_had' || r.kind === 'forgot'))
      .map((r) => r.name)
      .filter((name): name is string => Boolean(name)),
    coverage: judged ? taken.length / judged : null,
  };
}

/**
 * Every trip replayed against only what came before it, newest first.
 *
 * Trips with nothing PACKED are skipped rather than scored zero: a trip still being planned, or
 * created and abandoned, says nothing about the matcher, and a run of them would drag the average
 * somewhere meaningless.
 *
 * O(n²) in trips, since each is judged against all its predecessors. Fine at the scale a household
 * generates — and if it ever isn't, that is the good problem of having enough history to learn from.
 */
export function replayAll({
  trips,
  reflections = [],
  limit = SUGGESTION_BUDGET.review,
}: {
  trips: ReplayTrip[];
  reflections?: Reflection[];
  limit?: number;
}): TripReplay[] {
  const byAge = [...trips].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const earlier: ReplayTrip[] = [];
  const out: TripReplay[] = [];

  for (const trip of byAge) {
    if (packedOn(trip).length) {
      const known = new Set(earlier.map((t) => t.id));
      out.push(
        replayTrip({
          trip,
          past: [...earlier],
          // Only what had been said by then, plus this trip's own regrets — which are read rather
          // than fed to the matcher. A note written after a trip is not evidence the app could
          // have used before it.
          reflections: reflections.filter(
            (r) => r.trip?.id && (known.has(r.trip.id) || r.trip.id === trip.id),
          ),
          limit,
        }),
      );
    }
    earlier.push(trip);
  }

  return out.reverse();
}

/** The three numbers across every replayed trip, for reading one change against another. */
export function totals(replays: TripReplay[]) {
  const sum = (pick: (r: TripReplay) => unknown[]) =>
    replays.reduce((n, r) => n + pick(r).length, 0);

  const taken = sum((r) => r.taken);
  const missed = sum((r) => r.missed);

  return {
    trips: replays.length,
    taken,
    missed,
    ignored: sum((r) => r.ignored),
    coverage: taken + missed ? taken / (taken + missed) : null,
  };
}
