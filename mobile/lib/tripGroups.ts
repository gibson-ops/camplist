/** Anything leaving within this many days is imminent enough to want on screen. */
export const UP_NEXT_DAYS = 10;

/** How many of the more distant trips are worth showing before they become a count. */
export const LATER_SHOWN = 3;

const DAY = 24 * 60 * 60 * 1000;

/** Just enough of a trip to place it in time. */
export type DatedTrip = {
  departAt?: string | Date | null;
  returnAt?: string | Date | null;
  createdAt: string | Date;
};

/**
 * When a trip is over: its return date, or its departure if that's all it has.
 *
 * A trip you are ON is not past. That matters more than it sounds — the day you leave is the day
 * the app gets used hardest, and a list that has moved itself into "Past" the moment you set off
 * is a list you can no longer reach from the screen you land on.
 */
function endOf(trip: DatedTrip): number | null {
  const end = trip.returnAt ?? trip.departAt;
  return end ? +new Date(end) : null;
}

function startOf(trip: DatedTrip): number | null {
  return trip.departAt ? +new Date(trip.departAt) : null;
}

/**
 * Sorts a household's trips into what to show now, what to show a little of, and what to fold away.
 *
 * ONE TRIP MATTERS AT A TIME, usually. A packing list is read on the day, so a home screen that
 * lists every trip a household has ever taken buries the one being packed under history. Grouping
 * is what keeps the screen honest as the trip count grows.
 *
 * The rules, all of them Jared's:
 *   • `upNext` — anything departing within 10 days. If nothing is that close, the soonest one
 *     alone, so the group is never empty while a future trip exists.
 *   • `later`  — the rest of the future, soonest first, capped at 3 with the remainder counted.
 *   • `past`   — finished trips, newest first, collapsed by default.
 *
 * UNDATED TRIPS GO IN `upNext`, which is a judgement rather than a rule Jared gave. A trip with no
 * dates is one being written right now — it cannot be sorted against anything, and burying a draft
 * under "Later" would hide the thing most likely to be in progress.
 *
 * @param trips the household's trips, in any order
 * @param now injectable so tests aren't calendar-dependent
 * @returns the three groups plus how many `later` and `past` trips are folded away
 */
export function groupTrips<T extends DatedTrip>({
  trips,
  now = Date.now(),
}: {
  trips: T[];
  now?: number;
}) {
  const undated: T[] = [];
  const future: T[] = [];
  const past: T[] = [];

  for (const trip of trips) {
    const end = endOf(trip);
    if (end === null) undated.push(trip);
    else if (end < now) past.push(trip);
    else future.push(trip);
  }

  // Soonest first among the future; most recent first among the past. Both are "closest to today".
  future.sort((a, b) => (startOf(a) ?? endOf(a) ?? 0) - (startOf(b) ?? endOf(b) ?? 0));
  past.sort((a, b) => (endOf(b) ?? 0) - (endOf(a) ?? 0));
  undated.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const imminent = future.filter((trip) => {
    const start = startOf(trip) ?? endOf(trip)!;
    // Already underway counts: a trip you are on is the most imminent thing there is.
    return start - now <= UP_NEXT_DAYS * DAY;
  });

  // Never leave the group empty while a future trip exists — "Up next" with nothing under it reads
  // as having no trips at all.
  const upNext = [...undated, ...(imminent.length > 0 ? imminent : future.slice(0, 1))];
  const rest = future.filter((trip) => !upNext.includes(trip));

  return {
    upNext,
    later: rest.slice(0, LATER_SHOWN),
    laterHidden: Math.max(0, rest.length - LATER_SHOWN),
    past,
  };
}
