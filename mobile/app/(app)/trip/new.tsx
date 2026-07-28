import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { db } from '../../../lib/db';
import { useHousehold, useSession } from '../../../lib/useSession';
import { addSuggestedItems, createTrip } from '../../../lib/trips';
import { SUGGESTION_BUDGET, dismissedNames, suggestItems } from '../../../lib/itemSeeds';
import { axesOf, parseTags } from '../../../lib/tripMeta';
import { SuggestedList } from '../../../components/SuggestedList';
import { FIELD_PROMPT, TripField, type FieldKey } from '../../../components/TripFields';
import { useTripEditor, type LoadedTrip } from '../../../components/useTripEditor';
import { Button, Chevron, Input, Screen, Text, useTheme } from '../../../design';

/**
 * Making a trip, one question at a time.
 *
 * The details screen shows every field at once, which is right when you've come back to change
 * one thing and wrong at first contact — ten controls arriving together is the single reason
 * describing a trip felt like paperwork. Here each question gets a screen, a big target and
 * nothing else on it, so answering is a tap and a thumb-flick.
 *
 * NOTHING HERE IS A GATE. "Skip the rest" is on every screen from the second one, and the trip
 * is real from the moment it has a name — every step after that is an ordinary edit against a
 * trip that already exists. Abandoning halfway leaves a usable trip rather than nothing, which
 * is the difference between a wizard and a form with pacing.
 */
export default function NewTripScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const { householdId, isReady, personId } = useHousehold(user?.id);

  const [name, setName] = useState('');
  const [tripId, setTripId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);

  const { data } = db.useQuery(
    householdId
      ? {
          trips: { $: { where: { householdId } }, attendees: {}, lists: { owner: {}, items: {} } },
          people: { $: { where: { householdId } } },
          reflections: { $: { where: { householdId, kind: 'dismissed' } }, trip: {} },
        }
      : null,
  );

  const people = useMemo(
    () => [...(data?.people ?? [])].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [data?.people],
  );

  const trip = data?.trips?.find((candidate) => candidate.id === tripId);
  const trimmed = name.trim();

  // You're always going, so a household of one is never asked who else is coming — the step
  // comes out of the sequence rather than showing up with nothing to offer.
  const others = useMemo(() => people.filter((p) => p.id !== personId), [people, personId]);
  const steps = useMemo(
    () => STEPS.filter((field) => field !== 'attendees' || others.length > 0),
    [others.length],
  );

  /**
   * The last screen: what the app thinks you'll need, based on everything just answered.
   *
   * It goes LAST because it's the only step that reads all the others — asking about gear
   * before knowing whether you're in a tent or a hotel would be guessing, and this is the
   * moment the whole form pays for itself.
   */
  const isReview = step === steps.length + 1;

  const suggestions = useMemo(() => {
    if (!trip) return [];
    const axes = axesOf(trip);
    return suggestItems(
      {
        tags: [
          ...axes.tripTypes,
          ...axes.travelModes,
          ...axes.lodgings,
          ...parseTags(trip.activities),
          ...parseTags(trip.conditions),
        ],
        onList: (trip.lists ?? []).flatMap((l) => (l.items ?? []).map((i) => i.name)),
        dismissed: dismissedNames(data?.reflections ?? [], trip.id),
      },
      SUGGESTION_BUDGET.review,
    );
  }, [trip, data?.reflections]);

  const sharedList = (trip?.lists ?? []).find((l) => !l.owner);

  /**
   * Creates the trip and moves on. Everyone starts going: a household's default trip is the
   * whole household, and deselecting the one who's staying home is a smaller ask than picking
   * three people every time.
   */
  async function begin() {
    if (!householdId || !trimmed || creating) return;
    setCreating(true);
    const id = await createTrip({ householdId, name: trimmed, attendees: people });
    setTripId(id);
    setStep(1);
    setCreating(false);
  }

  const done = () => router.replace(tripId ? `/(app)/trip/${tripId}` : '/(app)');

  if (!householdId) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={t.color.signal} />
      </View>
    );
  }

  return (
    <Screen contentStyle={{ flexGrow: 1, gap: t.space.lg }}>
      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.lg }}>
        <Pressable
          onPress={() => (step === 0 ? router.back() : setStep((s) => s - 1))}
          accessibilityRole="button"
          accessibilityLabel={step === 0 ? 'Cancel' : 'Back'}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space.xs + 2,
            minHeight: t.touch.floor,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Chevron direction="left" size={11} />
          <Text variant="label" tone="muted">
            {step === 0 ? 'Cancel' : 'Back'}
          </Text>
        </Pressable>

        <Steps count={steps.length + 2} at={step} />
      </View>

      {step === 0 ? (
        <View style={{ paddingHorizontal: t.space.lg, gap: t.space.lg, flex: 1 }}>
          <Text variant="display">{FIELD_PROMPT.name}</Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Uintas, Labor Day"
            autoFocus
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={begin}
          />
          <View style={{ marginTop: 'auto', gap: t.space.sm }}>
            <Button
              label={isReady ? 'Start' : 'Starting…'}
              onPress={begin}
              disabled={!trimmed}
              loading={creating}
              full
            />
          </View>
        </View>
      ) : trip && isReview ? (
        <View style={{ paddingHorizontal: t.space.lg, gap: t.space.lg, flex: 1 }}>
          <View style={{ gap: t.space.xs }}>
            <Text variant="display">Probably need</Text>
            <Text variant="body" tone="muted">
              From what you just told me. Untick anything you won't take.
            </Text>
          </View>

          <SuggestedList
            items={suggestions}
            onSkip={done}
            onConfirm={(chosen) => {
              if (sharedList) {
                addSuggestedItems({
                  listId: sharedList.id,
                  householdId,
                  items: chosen,
                  startOrder: (sharedList.items ?? []).length,
                });
              }
              done();
            }}
          />
        </View>
      ) : trip ? (
        <StepBody
          key={trip.id}
          trip={trip}
          allTrips={data?.trips ?? []}
          householdId={householdId}
          meId={personId}
          people={others}
          field={steps[step - 1]}
          isLast={false}
          onNext={() => setStep((s) => s + 1)}
          onSkip={done}
        />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={t.color.signal} />
        </View>
      )}
    </Screen>
  );
}

/**
 * The questions after the name, in the order that makes each one easier than the last.
 *
 * Kind comes first because it seeds everything below it — answer it and the lodging, activity
 * and condition rows arrive already narrowed to this sort of trip. Dates come before travel for
 * the same reason: they decide the season, and the season rewrites the conditions.
 */
const STEPS: FieldKey[] = [
  'tripTypes',
  'attendees',
  'destination',
  'dates',
  'travelModes',
  'lodgings',
  'activities',
  'conditions',
];

function StepBody({
  trip,
  people,
  allTrips,
  householdId,
  meId,
  field,
  isLast,
  onNext,
  onSkip,
}: {
  trip: LoadedTrip;
  people: { id: string; name: string; color?: string }[];
  allTrips: { id: string; destination?: string; activities?: unknown; conditions?: unknown }[];
  householdId: string;
  meId?: string;
  field: FieldKey;
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  const t = useTheme();
  const editor = useTripEditor({ trip, people, allTrips, householdId, meId });

  return (
    <View style={{ paddingHorizontal: t.space.lg, gap: t.space.lg, flex: 1 }}>
      <Text variant="display">{FIELD_PROMPT[field]}</Text>

      <TripField field={field} people={people} {...editor} />

      <View style={{ marginTop: 'auto', gap: t.space.xs }}>
        {/* Always "Next", answered or not. An earlier version said "Not this trip" when nothing
            was picked, on the theory that naming the skip was friendlier — it read as the app
            rejecting the trip. Moving on IS the skip; it doesn't need announcing. */}
        <Button label={isLast ? 'Done' : 'Next'} onPress={onNext} full />
        {!isLast ? <Button label="Skip the rest" variant="ghost" onPress={onSkip} full /> : null}
      </View>
    </View>
  );
}

/** Where you are and how much is left. Thin rules, not numbers — see Meter. */
function Steps({ count, at }: { count: number; at: number }) {
  const t = useTheme();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${at + 1} of ${count}`}
      style={{ flexDirection: 'row', gap: t.space.xs + 1 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor: i <= at ? t.color.signal : t.color.raised,
          }}
        />
      ))}
    </View>
  );
}
