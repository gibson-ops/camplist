import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { db } from '../../../lib/db';
import { useHousehold, useSession } from '../../../lib/useSession';
import { addSuggestedItems, createTrip } from '../../../lib/trips';
import { SUGGESTION_BUDGET, dismissedNames } from '../../../lib/itemSeeds';
import { suggestFor } from '../../../lib/suggest';
import { verdictsFrom } from '../../../lib/reflections';
import { shapeOf } from '../../../lib/similarity';
import { SuggestedList } from '../../../components/SuggestedList';
import { SignInSheet } from '../../../components/SignInSheet';
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
  const { user, isGuest } = useSession();
  const { householdId, isReady, personId, profileId, pendingMerge } = useHousehold(user?.id);

  const [name, setName] = useState('');
  const [tripId, setTripId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [askingForAccount, setAskingForAccount] = useState(false);
  // Recorded at creation, because by the time the flow ends the household's trip count includes
  // the one it just made and can no longer answer whether this was the first.
  const [firstTrip, setFirstTrip] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const { data } = db.useQuery(
    householdId
      ? {
          // Every trip, not just this one: the suggestions are drawn from what past trips of the
          // same shape actually packed, so their lists are the point of the query.
          trips: {
            $: { where: { householdId } },
            attendees: {},
            lists: { owner: {}, items: { group: {} } },
          },
          people: { $: { where: { householdId } } },
          // Every kind, not just dismissals: a post-trip note is scoped by the SHAPE of the
          // trip it came from, so which one it belongs to is decided by the matcher, not here.
          reflections: { $: { where: { householdId } }, trip: {}, item: {} },
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
    return suggestFor({
      trip,
      // The matcher drops this trip and anything that doesn't resemble it, so the whole
      // household goes in unfiltered.
      past: data?.trips ?? [],
      onList: (trip.lists ?? []).flatMap((l) => (l.items ?? []).map((i) => i.name)),
      dismissed: dismissedNames(
        (data?.reflections ?? []).filter((r) => r.kind === 'dismissed'),
        trip.id,
      ),
      // The payoff moment for the whole loop: "you wished you'd had a second lantern" arrives
      // here, on the screen where the next list gets built.
      verdicts: verdictsFrom({
        reflections: data?.reflections ?? [],
        current: shapeOf(trip),
        past: data?.trips ?? [],
      }),
      limit: SUGGESTION_BUDGET.review,
    });
  }, [trip, data?.trips, data?.reflections]);

  /** Every list the trip has, in the order the trip screen shows them. */
  const targetLists = useMemo(
    () =>
      [...(trip?.lists ?? [])]
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((l) => ({ id: l.id, name: l.name, ownerId: l.owner?.id })),
    [trip?.lists],
  );

  /**
   * Creates the trip and moves on. Everyone starts going: a household's default trip is the
   * whole household, and deselecting the one who's staying home is a smaller ask than picking
   * three people every time.
   */
  async function begin() {
    if (!householdId || !trimmed || creating) return;
    setCreating(true);
    setFirstTrip((data?.trips?.length ?? 0) === 0);
    const id = await createTrip({ householdId, name: trimmed, attendees: people });
    setTripId(id);
    setStep(1);
    setCreating(false);
  }

  /**
   * Leaving the flow — via the account ask, if this is the first trip and there's no account yet.
   *
   * AFTER THE REVIEW, never before it. The review is the moment the app finally does the thing it
   * exists to do, and interrupting the walk up to it to ask for an email would be asking on
   * credit at the exact instant the credit was about to be repaid.
   *
   * Asking here is also what keeps the stranded-household merge a rare safety net rather than the
   * normal road: sign in now and there is never a second household to reconcile later.
   */
  const done = () => {
    if (isGuest && firstTrip) {
      setAskingForAccount(true);
      return;
    }
    leave();
  };

  const leave = () => router.replace(tripId ? `/(app)/trip/${tripId}` : '/(app)');

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

      {askingForAccount ? (
        <View style={{ paddingHorizontal: t.space.lg, gap: t.space.lg, flex: 1 }}>
          <View style={{ gap: t.space.sm, marginTop: t.space.lg }}>
            <Text variant="display">That&rsquo;s your first list</Text>
            {/* The consequence, not the feature. They have just watched the app produce something
                worth keeping, which is the only moment "you'd lose this" carries any weight. */}
            <Text variant="body" tone="muted">
              It only exists on this device. Add an email and it follows you to any other one — and
              every trip after this one gets better, because the app remembers what you packed.
            </Text>
          </View>

          <View style={{ marginTop: 'auto', gap: t.space.xs }}>
            <Button label="Keep my trips" onPress={() => setSigningIn(true)} full />
            {/* Never a dead end. The card on the home screen and the avatar both keep this
                available, so "not now" costs nothing and means what it says. */}
            <Button label="Not now" variant="ghost" onPress={leave} full />
          </View>
        </View>
      ) : step === 0 ? (
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
        <View style={{ gap: t.space.lg, flex: 1 }}>
          {/* The line explaining where the list came from belongs to SuggestedList, which is the
              only thing that knows whether any of it came from history. */}
          <Text variant="display" style={{ paddingHorizontal: t.space.lg }}>
            Probably need
          </Text>

          <SuggestedList
            seeds={suggestions}
            lists={targetLists}
            onSkip={done}
            onConfirm={(planned) => {
              addSuggestedItems({ householdId, planned });
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

      <SignInSheet
        visible={signingIn}
        guest={isGuest && householdId ? { household: householdId, person: personId } : undefined}
        onClose={() => setSigningIn(false)}
        onSignedIn={() => {
          setSigningIn(false);
          leave();
        }}
      />
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
