import { useEffect, useMemo, useRef, useState } from 'react';
import { axisValue, lodgingOf, parseTags } from '../lib/tripMeta';
import { tagsInUse } from '../lib/tagHistory';
import { setTripAttendees, updateTrip, type TripMetaPatch } from '../lib/trips';
import type { TripDraft } from './TripFields';

/** The trip as it arrives from InstantDB, before any of it has been read properly. */
export type LoadedTrip = {
  id: string;
  name: string;
  destination?: string;
  notes?: string;
  departAt?: string | number | Date;
  returnAt?: string | number | Date;
  tripType?: string;
  travel?: string;
  lodging?: string;
  /** DEPRECATED ancestor of `lodging`; still read so existing trips keep their value. */
  setting?: string;
  activities?: unknown;
  conditions?: unknown;
  attendees?: { id: string }[];
  lists?: {
    id: string;
    owner?: { id: string };
    items?: { id: string; children?: { id: string }[] }[];
  }[];
};

/**
 * Everything both trip-editing layouts need, so neither has to know how a trip is written.
 *
 * The stepper and the accordion ask the same questions in different shapes. Sharing the reads,
 * the writes and the draft-text handling here is what keeps them one form rather than two that
 * happen to look similar — and it means a rule fixed once (canonicalising a tag, translating a
 * legacy id, flushing a half-typed field) is fixed for both.
 */
export function useTripEditor({
  trip,
  people,
  allTrips,
  householdId,
  meId,
}: {
  trip: LoadedTrip;
  people: { id: string; name: string; color?: string }[];
  allTrips: { id: string; destination?: string; activities?: unknown; conditions?: unknown }[];
  householdId: string;
  /** The signed-in person. Always on the trip — see `onAttendees`. */
  meId?: string;
}) {
  const attendeeIds = useMemo(
    () => (trip.attendees ?? []).map((person) => person.id),
    [trip.attendees],
  );

  const lists = useMemo(
    () =>
      (trip.lists ?? []).map((list) => ({
        id: list.id,
        ownerId: list.owner?.id,
        itemCount: list.items?.length ?? 0,
      })),
    [trip.lists],
  );

  const draft: TripDraft = {
    name: trip.name,
    // All three single-value axes translate ids left over from the closed-set era.
    tripType: axisValue(trip.tripType),
    travel: axisValue(trip.travel),
    lodging: lodgingOf(trip),
    destination: trip.destination,
    notes: trip.notes,
    departAt: asDate(trip.departAt),
    returnAt: asDate(trip.returnAt),
    activities: parseTags(trip.activities),
    conditions: parseTags(trip.conditions),
    attendeeIds,
  };

  const save = (patch: TripMetaPatch) => updateTrip(trip.id, patch);

  /**
   * You are always going.
   *
   * Being able to deselect yourself reads as a bug — nobody plans a trip they aren't on, and
   * the one real exception (packing for a kid's camp you're not attending) is better served by
   * that kid having a list than by making everyone answer a question about themselves. So the
   * question is "who ELSE", and your own attendance is unioned back in on every write rather
   * than being a chip you could turn off by accident.
   */
  function onAttendees(next: string[]) {
    const going = new Set(next);
    if (meId) going.add(meId);

    setTripAttendees({
      tripId: trip.id,
      householdId,
      current: attendeeIds,
      // Ordered by the household's own order, not tap order, so seeded lists come out in a
      // stable sequence trip after trip.
      next: people.filter((p) => going.has(p.id)).map((p) => p.id),
      lists,
      names: new Map(people.map((p) => [p.id, p.name])),
    });
  }

  const name = useDraft(trip.name, (value) => value && save({ name: value }));
  const destination = useDraft(trip.destination ?? '', (value) => save({ destination: value }));
  const notes = useDraft(trip.notes ?? '', (value) => save({ notes: value }));
  const drafts = { name, destination, notes };

  /** Destinations already used, so repeat trips converge on one spelling instead of three. */
  const pastDestinations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const candidate of allTrips) {
      const value = candidate.destination?.trim();
      if (!value || candidate.id === trip.id) continue;
      if (!seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
    }
    return [...seen.values()].slice(0, 6);
  }, [allTrips, trip.id]);

  /**
   * Every tag this household already uses, most-used first. The `+` sheet offers these ahead of
   * anything the app ships, which is what makes a household converge on its own vocabulary.
   */
  const usedTags = useMemo(
    () => ({
      activities: tagsInUse(allTrips, 'activities'),
      conditions: tagsInUse(allTrips, 'conditions'),
    }),
    [allTrips],
  );

  return {
    draft,
    save,
    onAttendees,
    pastDestinations,
    usedTags,
    /** What the seed rules read. Most of the value is cross-axis, so it's the whole trip. */
    ctx: {
      tripType: draft.tripType,
      travel: draft.travel,
      lodging: draft.lodging,
      departAt: draft.departAt,
      returnAt: draft.returnAt,
    },
    text: (key: 'name' | 'destination' | 'notes') => drafts[key],
    itemCount: (trip.lists ?? []).reduce((n, list) => n + (list.items?.length ?? 0), 0),
  };
}

/**
 * A text field that writes when the user is done with it, not on every keystroke.
 *
 * Everything else commits the instant it's tapped, which is right for a chip and wrong for a
 * field you're still halfway through typing. Blur is the honest boundary — plus an unmount
 * flush, because leaving via the back gesture doesn't reliably blur first.
 *
 * @param stored the persisted value; also the guard against writing something already saved
 */
function useDraft(stored: string, commit: (value: string) => void) {
  const [value, setValue] = useState(stored);
  const latest = useRef({ value, stored, commit });
  latest.current = { value, stored, commit };

  const flush = () => {
    const trimmed = latest.current.value.trim();
    if (trimmed !== latest.current.stored) latest.current.commit(trimmed);
  };

  useEffect(() => () => flush(), []);

  return { value, set: setValue, flush, commit };
}

/** `i.date()` comes back as a string, a number, or a Date depending on how it was written. */
export function asDate(value?: string | number | Date): Date | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
