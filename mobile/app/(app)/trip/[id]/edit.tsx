import { useMemo } from 'react';
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
  SELF_LABELED,
  TripField,
  type FieldKey,
} from '../../../../components/TripFields';
import { useTripEditor, type LoadedTrip } from '../../../../components/useTripEditor';
import { Chevron, EmptyState, Screen, Text, useTheme } from '../../../../design';

/**
 * Everything a trip knows about itself, in one scroll.
 *
 * FLAT, ON PURPOSE — and this is the second answer, not the first. It was briefly an accordion:
 * ten collapsed rows each carrying its own answer, the whole trip on one screen. That optimizes
 * for reading a trip without changing it, which is not what anyone opens this screen to do. On
 * a screen you came to EDIT, a scroll is free and every open-and-close is a tap you didn't need
 * — and packing ten rows into one screenful reads as an admin panel rather than a description
 * of a weekend.
 *
 * So: one field per block, room between them, nothing hidden. The stepper at trip/new asks the
 * same questions one at a time, which is the right shape for first contact and the wrong one
 * for coming back to fix a date. Both render TripFields from useTripEditor, so they can't drift.
 */
export default function TripEditScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { householdId, personId } = useHousehold(user?.id);

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
      meId={personId}
      onDeleted={() => router.replace('/(app)')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
    />
  );
}

/** Ordered by what identifies a trip, then by what predicts its list. */
const FIELDS: FieldKey[] = [
  'name',
  'tripTypes',
  'attendees',
  'destination',
  'dates',
  'travelModes',
  'lodgings',
  'activities',
  'conditions',
  'notes',
];

function TripForm({
  trip,
  people,
  allTrips,
  householdId,
  meId,
  onDeleted,
  onBack,
}: {
  trip: LoadedTrip;
  people: { id: string; name: string; color?: string }[];
  allTrips: { id: string; destination?: string; activities?: unknown; conditions?: unknown }[];
  householdId: string;
  meId?: string;
  onDeleted: () => void;
  onBack: () => void;
}) {
  const t = useTheme();
  const editor = useTripEditor({ trip, people, allTrips, householdId, meId });

  // You're always going, so you're not one of the chips. A household of one has nobody else to
  // ask about, and the question disappears rather than sitting there answered.
  const others = useMemo(() => people.filter((p) => p.id !== meId), [people, meId]);

  const progress = metadataCompleteness({
    tripTypes: editor.draft.tripTypes,
    travelModes: editor.draft.travelModes,
    lodgings: editor.draft.lodgings,
    destination: editor.draft.destination,
    departAt: editor.draft.departAt,
    activities: editor.draft.activities,
    conditions: editor.draft.conditions,
    attendeeCount: editor.draft.attendeeIds.length,
  });

  return (
    <Screen contentStyle={{ gap: t.space.xl }}>
      <View style={{ gap: t.space.sm }}>
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
      </View>

      {FIELDS.filter((field) => field !== 'attendees' || others.length > 0).map((field) => (
        <View key={field} style={{ paddingHorizontal: t.space.lg, gap: t.space.sm }}>
          {SELF_LABELED.includes(field) ? null : (
            <Text variant="label" tone="muted">
              {FIELD_LABEL[field]}
            </Text>
          )}
          {/* Side by side here: each half is named above itself, and a form wants its fields
              compact. The stepper stacks them — it has a whole screen and one question. */}
          <TripField field={field} layout="row" people={others} {...editor} />
        </View>
      ))}

      <View style={{ paddingHorizontal: t.space.lg }}>
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

/** States what the next tap destroys. An empty trip says so rather than counting to zero. */
function confirmLabelFor(items: number) {
  if (items === 0) return 'Tap again to delete';
  return `Tap again — deletes ${items} item${items === 1 ? '' : 's'}`;
}
