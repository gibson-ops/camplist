import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { db } from '../../../../lib/db';
import { useHousehold, useSession } from '../../../../lib/useSession';
import { deleteTrip } from '../../../../lib/trips';
import { metadataCompleteness } from '../../../../lib/tripMeta';
import { ConfirmButton } from '../../../../components/ConfirmButton';
import { Meter } from '../../../../components/Meter';
import {
  FIELD_LABEL,
  TripField,
  fieldSummary,
  type FieldKey,
} from '../../../../components/TripFields';
import { useTripEditor, type LoadedTrip } from '../../../../components/useTripEditor';
import { Chevron, DisclosureRow, EmptyState, Screen, Text, useTheme } from '../../../../design';

/**
 * Everything a trip knows about itself, one row per answer.
 *
 * COLLAPSED BY DEFAULT, because coming back here is a targeted job: change one date, add an
 * activity, fix a name. The flat form this replaced showed ten controls at once and made you
 * scroll past nine to reach the one you came for. Every row now carries its own answer, so the
 * whole trip fits on a screen and scanning and editing are the same gesture.
 *
 * The stepper at trip/new asks these same questions one at a time, which is the right shape for
 * first contact and the wrong one for this. Both read from useTripEditor so they can't drift.
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
          // `children` is here so deleting a trip doesn't strand every kit's contents.
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

  // Keyed on the trip so the draft text fields initialise from real data exactly once. Without
  // it they'd mount empty during the query and flush that emptiness back on unmount.
  return (
    <TripForm
      key={trip.id}
      trip={trip}
      people={people}
      allTrips={data?.trips ?? []}
      householdId={householdId}
      onDeleted={() => router.replace('/(app)')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
    />
  );
}

/** Ordered by what identifies a trip, then by what predicts its list. */
const GROUPS: FieldKey[][] = [
  ['name', 'tripType', 'attendees'],
  ['destination', 'dates'],
  ['travel', 'lodging'],
  ['activities', 'conditions'],
  ['notes'],
];

function TripForm({
  trip,
  people,
  allTrips,
  householdId,
  onDeleted,
  onBack,
}: {
  trip: LoadedTrip;
  people: { id: string; name: string; color?: string }[];
  allTrips: { id: string; destination?: string; activities?: unknown; conditions?: unknown }[];
  householdId: string;
  onDeleted: () => void;
  onBack: () => void;
}) {
  const t = useTheme();
  const editor = useTripEditor({ trip, people, allTrips, householdId });

  // One at a time. Two open rows is most of a flat form again, and collapsing them was the
  // whole point of keeping the trip on one screen.
  const [open, setOpen] = useState<FieldKey | null>(null);

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);

  const progress = metadataCompleteness({
    tripType: editor.draft.tripType,
    travel: editor.draft.travel,
    lodging: editor.draft.lodging,
    destination: editor.draft.destination,
    departAt: editor.draft.departAt,
    activities: editor.draft.activities,
    conditions: editor.draft.conditions,
    attendeeCount: editor.draft.attendeeIds.length,
  });

  return (
    <Screen contentStyle={{ gap: t.space.md }}>
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

      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.sm }}>
        <Text variant="display">Trip details</Text>
        <Meter filled={progress.filled} total={progress.total} />
      </View>

      {GROUPS.map((group, groupIndex) => (
        <View key={groupIndex}>
          {group.map((field, i) => (
            <DisclosureRow
              key={field}
              label={FIELD_LABEL[field]}
              value={fieldSummary(field, editor.draft, peopleById)}
              placeholder={PLACEHOLDER[field]}
              open={open === field}
              onToggle={() => setOpen((was) => (was === field ? null : field))}
              isLast={i === group.length - 1}
            >
              <TripField field={field} people={people} {...editor} />
            </DisclosureRow>
          ))}
        </View>
      ))}

      <View style={{ paddingHorizontal: t.space.lg, paddingTop: t.space.md }}>
        <ConfirmButton
          label="Delete trip"
          confirmLabel={confirmLabelFor(editor.itemCount)}
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
 * What an unanswered row says.
 *
 * In its own words rather than a shared "Not set", because a row is the only place these
 * questions get asked here, and a blank one should still read like an invitation.
 */
const PLACEHOLDER: Record<FieldKey, string> = {
  name: 'Untitled',
  tripType: 'Any kind',
  attendees: 'Nobody yet',
  destination: 'Somewhere',
  dates: 'No dates',
  travel: 'Not set',
  lodging: 'Not set',
  activities: 'Nothing yet',
  conditions: 'Nothing noted',
  notes: 'None',
};

/** States what the next tap destroys. An empty trip says so rather than counting to zero. */
function confirmLabelFor(items: number) {
  if (items === 0) return 'Tap again to delete';
  return `Tap again — deletes ${items} item${items === 1 ? '' : 's'}`;
}
