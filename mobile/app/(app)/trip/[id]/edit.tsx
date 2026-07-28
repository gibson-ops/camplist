import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { db } from '../../../../lib/db';
import { useHousehold, useSession } from '../../../../lib/useSession';
import {
  deleteTrip,
  setTripAttendees,
  updateTrip,
  type TripMetaPatch,
} from '../../../../lib/trips';
import { axisValue, lodgingOf, metadataCompleteness, parseTags } from '../../../../lib/tripMeta';
import { tagsInUse } from '../../../../lib/tagHistory';
import { ConfirmButton } from '../../../../components/ConfirmButton';
import { DateRangeField } from '../../../../components/DateRangeField';
import { TagField } from '../../../../components/TagField';
import {
  Chevron,
  EmptyState,
  Input,
  PersonChip,
  Screen,
  SelectChip,
  Text,
  useTheme,
} from '../../../../design';

/**
 * Everything a trip knows about itself.
 *
 * This screen is the input side of the product. A packing list that can't be matched against
 * past trips has nothing to suggest, and a trip with only a name can't be matched against
 * anything — so the fields here aren't administrative detail, they're the query.
 *
 * Which is also why it says so, out loud, in the completeness line: filling a field in is a
 * trade the user should be able to see the point of.
 */
export default function TripEditScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { householdId } = useHousehold(user?.id);

  const { data, isLoading } = db.useQuery(
    tripId && householdId
      ? {
          // Items come along for their count: an emptied-out list is safe to remove when its
          // owner leaves the trip, a list with anything on it is not (see lib/attendees.ts).
          // `children` is here for the same reason as on the trips screen — deleting a trip
          // without them would strand every kit's contents.
          trips: {
            $: { where: { householdId } },
            attendees: {},
            lists: { owner: {}, items: { children: {} } },
          },
          people: { $: { where: { householdId } } },
        }
      : null,
  );

  const trip = data?.trips?.find((candidate) => candidate.id === tripId);

  const people = useMemo(
    () => [...(data?.people ?? [])].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [data?.people],
  );

  /** Destinations already used, so repeat trips converge on one spelling instead of three. */
  const pastDestinations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const candidate of data?.trips ?? []) {
      const value = candidate.destination?.trim();
      if (!value || candidate.id === tripId) continue;
      if (!seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
    }
    return [...seen.values()].slice(0, 6);
  }, [data?.trips, tripId]);

  /**
   * Every tag this household already uses, most-used first. The `+` sheet offers these ahead of
   * anything the app ships, which is what makes a household converge on its own vocabulary
   * rather than drifting into three spellings of the same idea.
   */
  const usedTags = useMemo(
    () => ({
      activities: tagsInUse(data?.trips ?? [], 'activities'),
      conditions: tagsInUse(data?.trips ?? [], 'conditions'),
    }),
    [data?.trips],
  );

  if (isLoading || !householdId) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={t.color.signal} />
      </View>
    );
  }

  if (!trip) {
    return (
      <Screen>
        <EmptyState
          title="That trip is gone."
          body="It may have been deleted on another device."
          actionLabel="Back to trips"
          onAction={() => router.replace('/(app)')}
        />
      </Screen>
    );
  }

  // Keyed on the trip so the draft fields below initialise from real data exactly once. Without
  // it they'd mount empty during the query and flush that emptiness back on unmount.
  return (
    <TripForm
      key={trip.id}
      trip={trip}
      people={people}
      householdId={householdId}
      pastDestinations={pastDestinations}
      usedTags={usedTags}
      onDeleted={() => router.replace('/(app)')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
    />
  );
}

type LoadedTrip = {
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

function TripForm({
  trip,
  people,
  householdId,
  pastDestinations,
  usedTags,
  onDeleted,
  onBack,
}: {
  trip: LoadedTrip;
  people: { id: string; name: string; color?: string }[];
  householdId: string;
  pastDestinations: string[];
  usedTags: { activities: string[]; conditions: string[] };
  onDeleted: () => void;
  onBack: () => void;
}) {
  const t = useTheme();

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

  const activities = parseTags(trip.activities);
  const conditions = parseTags(trip.conditions);
  // All three single-value axes translate ids left over from the closed-set era.
  const tripType = axisValue(trip.tripType);
  const travel = axisValue(trip.travel);
  const lodging = lodgingOf(trip);

  const save = (patch: TripMetaPatch) => updateTrip(trip.id, patch);

  const name = useDraft(trip.name, (value) => value && save({ name: value }));
  const destination = useDraft(trip.destination ?? '', (value) => save({ destination: value }));
  const notes = useDraft(trip.notes ?? '', (value) => save({ notes: value }));

  /*
   * There is deliberately NO backfill here.
   *
   * Trips made before attendance existed show their people only as list owners, and it is
   * tempting to record that on open: no attendees + some list owners must mean the owners went.
   * It doesn't. Removing someone whose list has anything on it leaves that list standing on
   * purpose (see lib/attendees.ts), so "owns a list but isn't going" is a state the app creates
   * itself — and a backfill reading it as "must be going" re-adds the person the user just
   * removed, on the very next screen open. Caught on device, not in review.
   *
   * The two rules can't both hold, and the deletion rule is the one worth keeping. An old trip
   * simply opens with nobody selected, which is one tap to fix on the screen built for it.
   */

  function toggleAttendee(personId: string) {
    const going = new Set(attendeeIds);
    if (going.has(personId)) going.delete(personId);
    else going.add(personId);

    setTripAttendees({
      tripId: trip.id,
      householdId,
      current: attendeeIds,
      // Ordered by the household's own order so seeded lists come out in a stable sequence.
      next: people.filter((p) => going.has(p.id)).map((p) => p.id),
      lists,
      names: new Map(people.map((p) => [p.id, p.name])),
    });
  }

  /**
   * What the seed rules read. Assembled once because most of the value is CROSS-AXIS — flying,
   * snow and a week away each say more about what to pack than the trip type does.
   */
  const ctx = {
    tripType,
    travel,
    lodging,
    departAt: asDate(trip.departAt),
    returnAt: asDate(trip.returnAt),
  };

  const progress = metadataCompleteness({
    tripType,
    travel,
    lodging,
    destination: trip.destination,
    departAt: asDate(trip.departAt),
    activities,
    conditions,
    attendeeCount: attendeeIds.length,
  });

  return (
    <Screen contentStyle={{ gap: t.space.lg }}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to the packing list"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.xs + 2,
          minHeight: t.touch.floor,
          paddingHorizontal: t.space.lg,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Chevron direction="left" size={11} />
        <Text variant="label" tone="muted" numberOfLines={1}>
          {trip.name}
        </Text>
      </Pressable>

      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.xs }}>
        <Text variant="display">Trip details</Text>
        <Text variant="body" tone="muted">
          {progress.filled === progress.total
            ? 'Fully described. Past trips can be matched on every axis.'
            : `${progress.filled} of ${progress.total}. Every field you fill in is another way this trip can be matched against past ones.`}
        </Text>
      </View>

      <View style={{ paddingHorizontal: t.space.lg }}>
        <Input
          label="Name"
          value={name.value}
          onChangeText={name.set}
          onBlur={name.flush}
          autoCapitalize="words"
          returnKeyType="done"
        />
      </View>

      <TagField
        label="What kind of trip"
        hint="Seeds everything below it — a work trip and a backpacking trip barely share a list."
        kind="tripType"
        single
        selected={tripType ? [tripType] : []}
        onChange={(next) => save({ tripType: next[0] ?? '' })}
      />

      <View style={{ gap: t.space.sm, paddingHorizontal: t.space.lg }}>
        <Text variant="label" tone="muted">
          Who's going
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
          {people.map((person) => (
            <PersonChip
              key={person.id}
              name={person.name}
              color={person.color}
              active={attendeeIds.includes(person.id)}
              onPress={() => toggleAttendee(person.id)}
            />
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.sm }}>
        <Input
          label="Where"
          // Describes rather than exemplifies. The chips underneath are real past
          // destinations, and an example place name in the field reads as one of them.
          placeholder="Where you're headed"
          value={destination.value}
          onChangeText={destination.set}
          onBlur={destination.flush}
          autoCapitalize="words"
          returnKeyType="done"
        />
        {/* Somewhere you've been before, one tap away. Free text can't be matched across trips
            unless the spelling converges, and offering the old spelling is cheaper than asking
            anyone to remember whether they wrote "Uintas" or "the Uintas" last August. */}
        {pastDestinations.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            {pastDestinations.map((place) => (
              <SelectChip
                key={place}
                label={place}
                selected={destination.value.trim().toLowerCase() === place.toLowerCase()}
                onPress={() => {
                  destination.set(place);
                  destination.commit(place);
                }}
              />
            ))}
          </View>
        ) : null}
      </View>

      <DateRangeField
        departAt={asDate(trip.departAt)}
        returnAt={asDate(trip.returnAt)}
        onChange={(next) => save(next)}
      />

      <TagField
        label="Getting there"
        hint="Flying constrains a list harder than anything else here — bag weight, liquids, nothing with fuel in it."
        kind="travel"
        single
        selected={travel ? [travel] : []}
        onChange={(next) => save({ travel: next[0] ?? '' })}
      />

      <TagField
        label="Where you're sleeping"
        hint="Decides the sleep system, the towels, and whether there's a kitchen."
        kind="lodging"
        trip={ctx}
        single
        selected={lodging ? [lodging] : []}
        // Written to `lodging`; the old `setting` attr is left untouched and read-only.
        onChange={(next) => save({ lodging: next[0] ?? '' })}
      />

      <TagField
        label="What you'll be doing"
        hint="Each one drags its own gear along behind it."
        kind="activities"
        trip={ctx}
        selected={activities}
        used={usedTags.activities}
        onChange={(next) => save({ activities: next })}
      />

      <TagField
        label="What you're up against"
        hint="What you expect, not a forecast. The reflection afterwards is where reality gets recorded."
        kind="conditions"
        trip={ctx}
        selected={conditions}
        used={usedTags.conditions}
        onChange={(next) => save({ conditions: next })}
      />

      <View style={{ paddingHorizontal: t.space.lg }}>
        <Input
          label="Notes"
          placeholder="Anything the chips can't say"
          value={notes.value}
          onChangeText={notes.set}
          onBlur={notes.flush}
          multiline
          style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }}
        />
      </View>

      <View style={{ paddingHorizontal: t.space.lg, paddingTop: t.space.lg }}>
        <ConfirmButton
          label="Delete trip"
          confirmLabel={confirmLabelFor(countItems(trip))}
          onConfirm={() => {
            deleteTrip(trip.id, trip.lists ?? []);
            onDeleted();
          }}
        />
      </View>
    </Screen>
  );
}

/**
 * A text field that writes when the user is done with it, not on every keystroke.
 *
 * Everything else on this screen commits the instant it's tapped, which is right for a chip and
 * wrong for a field you're still halfway through typing. Blur is the honest boundary — plus an
 * unmount flush, because leaving via the back gesture doesn't reliably blur first.
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
function asDate(value?: string | number | Date): Date | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function countItems(trip: LoadedTrip) {
  return (trip.lists ?? []).reduce((n, list) => n + (list.items?.length ?? 0), 0);
}

/** States what the next tap destroys. An empty trip says so rather than counting to zero. */
function confirmLabelFor(items: number) {
  if (items === 0) return 'Tap again to delete';
  return `Tap again — deletes ${items} item${items === 1 ? '' : 's'}`;
}
