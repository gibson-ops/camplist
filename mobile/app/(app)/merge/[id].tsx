import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { db } from '../../../lib/db';
import { useHousehold, useSession } from '../../../lib/useSession';
import { mergeHousehold } from '../../../lib/trips';
import { describeMerge, planMerge, type GuestHousehold } from '../../../lib/merge';
import { Button, EmptyState, NavRow, Screen, SectionHeader, Text, useTheme } from '../../../design';

/**
 * What you made before signing in, and one button to keep it.
 *
 * Reachable from the home screen for as long as it's unresolved, rather than being a prompt that
 * fires once after sign-in. A one-shot offer is the same as no offer: dismiss it by accident, or
 * close the app while reading it, and real trips become permanently invisible with no evidence
 * they ever existed.
 *
 * The trips are LISTED, not summarized, because this asks for a decision about specific things
 * and "3 trips" is not enough to decide with — the answer differs completely depending on
 * whether they're your family's real trips or something you typed while poking at the app.
 */
export default function MergeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id: strandedId } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { householdId, profileId, personId, pendingMerge } = useHousehold(user?.id);
  // The guest's own person, recorded at sign-in. It cannot be worked out from here: a linked
  // guest's profile isn't readable, so nothing on the person row says which one was you.
  const guestSelfPersonId = pendingMerge.find((e) => e.household === strandedId)?.person;
  const [moving, setMoving] = useState(false);
  const [problem, setProblem] = useState<string>();

  /**
   * Everything in the stranded household.
   *
   * Readable because `instant.perms.ts` grants access through the linked-guest clause — the same
   * clause that makes this whole feature a client transaction rather than a server job.
   */
  const { data, isLoading } = db.useQuery(
    strandedId
      ? {
          people: { $: { where: { householdId: strandedId } }, profile: {} },
          trips: { $: { where: { householdId: strandedId } } },
          lists: { $: { where: { householdId: strandedId } }, owner: {} },
          items: { $: { where: { householdId: strandedId } } },
          itemGroups: { $: { where: { householdId: strandedId } } },
          groupItems: { $: { where: { householdId: strandedId } } },
          reflections: { $: { where: { householdId: strandedId } }, person: {} },
        }
      : null,
  );

  const guest: GuestHousehold | undefined = useMemo(() => {
    if (!data || !strandedId) return undefined;
    return {
      id: strandedId,
      people: (data.people ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        profileId: p.profile?.id,
      })),
      trips: (data.trips ?? []).map((trip) => ({ id: trip.id, name: trip.name })),
      lists: (data.lists ?? []).map((l) => ({ id: l.id, ownerId: l.owner?.id })),
      items: (data.items ?? []).map((i) => ({ id: i.id })),
      itemGroups: (data.itemGroups ?? []).map((g) => ({ id: g.id })),
      groupItems: (data.groupItems ?? []).map((g) => ({ id: g.id })),
      reflections: (data.reflections ?? []).map((r) => ({ id: r.id, personId: r.person?.id })),
    };
  }, [data, strandedId]);

  const plan = useMemo(
    () => (guest ? planMerge({ guest, guestSelfPersonId, selfPersonId: personId }) : undefined),
    [guest, guestSelfPersonId, personId],
  );

  const done = () => router.replace('/(app)');

  function move() {
    if (!plan || !householdId || !profileId || !strandedId || moving) return;
    setMoving(true);
    setProblem(undefined);
    mergeHousehold({
      plan,
      from: strandedId,
      into: householdId,
      profileId,
      pending: pendingMerge,
    })
      .then(done)
      .catch((err) => {
        // Shown, never swallowed. This button moves data somebody is worried about losing, and a
        // tap that quietly does nothing reads as "it ate them" — the exact fear it exists to end.
        setProblem(
          (err as { body?: { message?: string } })?.body?.message ??
            (err as { message?: string })?.message ??
            'That did not work. Nothing was moved.',
        );
        setMoving(false);
      });
  }

  if (isLoading || !householdId) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={t.color.signal} />
      </View>
    );
  }

  if (!plan) {
    return (
      <Screen>
        <EmptyState
          title="Nothing left to move."
          body="Everything from before you signed in is already in this household."
          actionLabel="Back to trips"
          onAction={done}
        />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ gap: t.space.lg }}>
      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.xs }}>
        <Text variant="display">From before you signed in</Text>
        <Text variant="body" tone="muted">
          You made these on this device without an account. They&rsquo;re still here — move them
          into your household and they&rsquo;ll follow you everywhere else.
        </Text>
      </View>

      {guest && guest.trips.length > 0 ? (
        <View>
          <SectionHeader title="Trips" count={String(guest.trips.length)} />
          <View style={{ backgroundColor: t.color.surface }}>
            {guest.trips.map((trip, i) => (
              <NavRow key={trip.id} title={trip.name} isLast={i === guest.trips.length - 1} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.xs }}>
        {problem ? (
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        ) : null}

        <Button label={describeMerge(plan.summary)} onPress={move} loading={moving} full />
        {/* Not a delete. Nothing here is destroyed by walking away, and the row on the home
            screen stays until the answer is yes — this is genuinely "later", so it says so. */}
        <Button label="Not now" variant="ghost" onPress={done} full />
      </View>
    </Screen>
  );
}
