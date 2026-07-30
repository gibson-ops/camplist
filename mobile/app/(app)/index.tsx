import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { db } from '../../lib/db';
import { useHousehold, useSession } from '../../lib/useSession';
import { accountInitials } from '../../lib/identity';
import { onboardingStep } from '../../lib/onboarding';
import { groupTrips } from '../../lib/tripGroups';
import { SignInSheet } from '../../components/SignInSheet';
import { addPerson, finishOnboarding, renamePerson } from '../../lib/trips';
import { tripSummary } from '../../lib/tripMeta';
import { NameSheet } from '../../components/NameSheet';
import { AddRow, Avatar, NavRow, Screen, SectionHeader, Text, useTheme } from '../../design';

/**
 * The app's home: every trip, and the people trips get packed for.
 *
 * People live here rather than behind a settings gear because on a fresh install the
 * household is one nameless person, and the trip screen's whole structure — a list per
 * person — is invisible until that's fixed. Putting it one scroll below the trips makes the
 * fix discoverable at exactly the moment it starts to matter.
 */
export default function TripsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user, isGuest } = useSession();
  const { householdId, profileId, personId, pendingMerge, needsOnboarding } = useHousehold(
    user?.id,
  );
  const [signingIn, setSigningIn] = useState(false);
  /** Past trips stay folded until asked for: they are history, not the thing being packed. */
  const [showPast, setShowPast] = useState(false);

  const [newPerson, setNewPerson] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const { data, error } = db.useQuery(
    householdId
      ? {
          // `children` comes along so a trip can be deleted without orphaning kit contents.
          trips: {
            $: { where: { householdId } },
            attendees: {},
            lists: { items: { children: {} } },
          },
          people: { $: { where: { householdId } } },
          // For the avatar: initials once the account is real, nothing while it isn't.
          profiles: { $: { where: { id: profileId ?? '' } } },
        }
      : null,
  );

  // Ordered client-side: sortOrder and createdAt aren't both indexed, and a household's
  // trips and people number in the tens, so there is nothing to gain from a server sort.
  const trips = useMemo(
    () => [...(data?.trips ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [data?.trips],
  );
  /** What to show now, what to show a little of, and what to fold away. See lib/tripGroups.ts. */
  const groups = useMemo(() => groupTrips({ trips }), [trips]);
  const people = useMemo(
    () => [...(data?.people ?? [])].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [data?.people],
  );
  const profile = data?.profiles?.[0];
  const email = (user as { email?: string } | undefined)?.email;

  /**
   * First run goes to onboarding; everyone else is left alone.
   *
   * The decision is a tested function rather than a condition here, because getting it wrong is
   * invisible until it isn't: an earlier version redirected on a missing flag alone, which caught
   * every account created before the flag existed and bounced them between this screen and the
   * welcome screen forever. See lib/onboarding.ts.
   */
  useEffect(() => {
    const next = onboardingStep({
      needsOnboarding,
      tripsLoaded: Boolean(data),
      tripCount: trips.length,
    });

    if (next === 'show') router.replace('/(app)/welcome');
    // Trips prove they've been here. Write the flag so the question is answered for good.
    else if (next === 'backfill' && profileId) finishOnboarding(profileId);
  }, [needsOnboarding, data, trips.length, profileId, router]);

  /** One trip row. Identical in all three groups — the grouping is the only thing that differs. */
  function tripRow(trip: (typeof trips)[number]) {
    const items = (trip.lists ?? []).flatMap((l) => l.items ?? []);
    const packed = items.filter((i) => i.state !== 'unpacked').length;
    return (
      <NavRow
        key={trip.id}
        title={trip.name}
        // Where and when only. A NavRow gives the meta one line beside the title, and the full
        // summary truncates mid-fact there ("Car camping ·…"); these two are what actually tell
        // one trip from another in a list.
        meta={tripSummary({
          destination: trip.destination,
          departAt: trip.departAt,
          returnAt: trip.returnAt,
        })}
        count={items.length > 0 ? `${packed}/${items.length}` : undefined}
        onPress={() => router.push(`/(app)/trip/${trip.id}`)}
      />
    );
  }

  return (
    <Screen>
      <View
        style={{
          paddingHorizontal: t.space.lg,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: t.space.md,
        }}
      >
        <View style={{ flex: 1, gap: t.space.xs, minWidth: 0 }}>
          <Text variant="display">Camp List</Text>
          <Text variant="body" tone="muted">
            {trips.length === 0
              ? 'Start a trip. Everything else follows from it.'
              : `${trips.length} trip${trips.length === 1 ? '' : 's'}`}
          </Text>
        </View>

        {/* Present while still a guest, on purpose: this is the permanent way back to finishing
            an account, so the ask never depends on a card that's been scrolled past. It reports
            the state by changing shape — an outline until there's a real account, initials
            after — which is why there's no badge on it. */}
        <Avatar
          initials={accountInitials({ name: profile?.name, email, isGuest })}
          imageUrl={isGuest ? undefined : profile?.avatarUrl}
          label={isGuest ? 'Account. Not signed in yet' : 'Your account'}
          onPress={() => router.push('/(app)/account')}
        />
      </View>

      {/*
        GROUPED, because a packing list is read on the day. A flat list buries the trip being
        packed under every trip the household has ever taken, and it gets worse with use.
      */}
      {/* Only when there is one. A heading for a state you are not in is noise, and on every
          other day of the year this is absent. */}
      {groups.current.length > 0 ? (
        <>
          <SectionHeader title={groups.current.length > 1 ? 'On now' : 'On this trip'} />
          <View style={{ backgroundColor: t.color.surface }}>
            {groups.current.map((trip) => tripRow(trip))}
          </View>
        </>
      ) : null}

      {groups.upNext.length > 0 ? <SectionHeader title="Up next" /> : null}
      <View style={{ backgroundColor: t.color.surface }}>
        {groups.upNext.map((trip) => tripRow(trip))}
        <AddRow label="New trip" onPress={() => router.push('/(app)/trip/new')} />
      </View>

      {groups.later.length > 0 ? (
        <>
          <SectionHeader title="Later" />
          <View style={{ backgroundColor: t.color.surface }}>
            {groups.later.map((trip) => tripRow(trip))}
            {/* A count rather than a cut: three is enough to plan against, and hiding the rest
                without saying so makes the app look like it lost them. */}
            {groups.laterHidden > 0 ? (
              <View style={{ paddingHorizontal: t.space.lg, paddingVertical: t.space.md }}>
                <Text variant="caption" tone="muted">
                  {groups.laterHidden} more further out
                </Text>
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      {groups.past.length > 0 ? (
        <>
          {/* Collapsed by default. A finished trip is worth keeping — it is what the app learns
              from — and worth staying out of the way of the one being packed. */}
          {/* The number goes in the TITLE, not `count`: that prop is announced as "N packed",
              which is right for a list of things and wrong for a count of trips. */}
          <SectionHeader
            title={`Past · ${groups.past.length}`}
            expanded={showPast}
            onToggle={() => setShowPast((open) => !open)}
          />
          {showPast ? (
            <View style={{ backgroundColor: t.color.surface }}>
              {groups.past.map((trip) => tripRow(trip))}
            </View>
          ) : null}
        </>
      ) : null}

      {/*
        Deliberately NOT a row in the household list, which is where this started. Styled as one
        it carried the same weight as "Add someone" — a minor utility — when it is the only thing
        standing between a guest and losing every trip they have the moment they change phones.
        Quiet was right; indistinguishable was not.

        Still not a modal and still not a gate. It waits until there is something to lose, which
        is also the only point at which the sentence is true: with no trips there is nothing that
        "only exists on this device", and asking then would be asking on credit.
      */}
      {isGuest && trips.length > 0 ? (
        <Pressable
          onPress={() => setSigningIn(true)}
          accessibilityRole="button"
          accessibilityLabel="These trips only exist on this device. Sign in to keep them."
          style={({ pressed }) => ({
            marginHorizontal: t.space.lg,
            marginTop: t.space.md,
            padding: t.space.md,
            borderRadius: t.radius.sm,
            backgroundColor: t.color.raised,
            gap: 2,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {/* States the risk rather than the reward. "Keep your trips" is a benefit nobody has
              reason to price; "only on this device" is a fact with an obvious consequence. */}
          <Text variant="title">These trips only exist on this device</Text>
          <Text variant="caption" tone="muted">
            Sign in and they follow you to any other one. No password — just a code by email.
          </Text>
        </Pressable>
      ) : null}

      <SectionHeader title="Household" />
      <View style={{ backgroundColor: t.color.surface }}>
        {people.map((person) => (
          <NavRow
            key={person.id}
            title={person.name}
            onPress={() => setEditing({ id: person.id, name: person.name })}
          />
        ))}
        <AddRow label="Add someone" onPress={() => setNewPerson(true)} />
      </View>

      {/* Data made on this device before signing in, which now belongs to a household the app
          doesn't show. Findable until it's dealt with — see lib/merge.ts. */}
      {pendingMerge.length > 0 ? (
        <>
          <SectionHeader title="From before you signed in" />
          <View style={{ backgroundColor: t.color.surface }}>
            {pendingMerge.map((entry, i) => (
              <NavRow
                key={entry.household}
                title="Trips you made as a guest"
                meta="Move them into this household"
                isLast={i === pendingMerge.length - 1}
                onPress={() => router.push(`/(app)/merge/${entry.household}`)}
              />
            ))}
          </View>
        </>
      ) : null}

      {error ? (
        <View style={{ paddingHorizontal: t.space.lg, paddingTop: t.space.md }}>
          <Text variant="body" tone="danger">
            {String((error as { message?: string }).message ?? error)}
          </Text>
        </View>
      ) : null}

      <SignInSheet
        visible={signingIn}
        // Read NOW, while this is still the guest's own session. Afterwards the hook returns the
        // account's household, and the guest's own person can't be identified at all — a linked
        // guest's profile isn't readable, so nothing on the row says which person was you.
        guest={isGuest && householdId ? { household: householdId, person: personId } : undefined}
        onClose={() => setSigningIn(false)}
        // Held rather than written: see useStrandedRecorder for why it can't happen now.
        onSignedIn={() => {
          setSigningIn(false);
        }}
      />

      <NameSheet
        visible={newPerson}
        title="Add someone"
        label="Name"
        placeholder="Brooke"
        submitLabel="Add"
        onSubmit={(name) => householdId && addPerson({ householdId, name })}
        onClose={() => setNewPerson(false)}
      />

      <NameSheet
        visible={Boolean(editing)}
        title="Rename"
        label="Name"
        initialValue={editing?.name ?? ''}
        onSubmit={(name) => editing && renamePerson(editing.id, name)}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}
