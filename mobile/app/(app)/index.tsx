import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { db } from '../../lib/db';
import { useHousehold, useSession } from '../../lib/useSession';
import { addPendingMerge } from '../../lib/trips';
import { SignInSheet } from '../../components/SignInSheet';
import type { StrandedHousehold } from '../../lib/merge';
import { addPerson, renamePerson } from '../../lib/trips';
import { tripSummary } from '../../lib/tripMeta';
import { NameSheet } from '../../components/NameSheet';
import { AddRow, Button, NavRow, Screen, SectionHeader, Text, useTheme } from '../../design';

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
  const { householdId, profileId, personId, pendingMerge } = useHousehold(user?.id);
  const [signingIn, setSigningIn] = useState(false);
  const [stranded, setStranded] = useState<StrandedHousehold>();

  /**
   * Records a stranded household once the signed-in profile actually exists.
   *
   * Sign-in swaps the identity out from under the query, and the new user's profile may still be
   * bootstrapping. Waiting for `profileId` is what makes the note land on the account rather than
   * on the guest that's being left behind.
   */
  useEffect(() => {
    if (!stranded || !profileId) return;
    addPendingMerge({ profileId, pending: pendingMerge, stranded }).finally(() =>
      setStranded(undefined),
    );
  }, [stranded, profileId, pendingMerge]);

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
        }
      : null,
  );

  // Ordered client-side: sortOrder and createdAt aren't both indexed, and a household's
  // trips and people number in the tens, so there is nothing to gain from a server sort.
  const trips = useMemo(
    () => [...(data?.trips ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [data?.trips],
  );
  const people = useMemo(
    () => [...(data?.people ?? [])].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [data?.people],
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.xs }}>
        <Text variant="display">Camp List</Text>
        <Text variant="body" tone="muted">
          {trips.length === 0
            ? 'Start a trip. Everything else follows from it.'
            : `${trips.length} trip${trips.length === 1 ? '' : 's'}`}
        </Text>
      </View>

      <SectionHeader title="Trips" />
      <View style={{ backgroundColor: t.color.surface }}>
        {trips.map((trip) => {
          const items = (trip.lists ?? []).flatMap((l) => l.items ?? []);
          const packed = items.filter((i) => i.state !== 'unpacked').length;
          return (
            <NavRow
              key={trip.id}
              title={trip.name}
              // Where and when only. A NavRow gives the meta one line beside the title, and
              // the full summary truncates mid-fact there ("Car camping ·…"); these two are
              // what actually tell one trip from another in a list.
              meta={tripSummary({
                destination: trip.destination,
                departAt: trip.departAt,
                returnAt: trip.returnAt,
              })}
              count={items.length > 0 ? `${packed}/${items.length}` : undefined}
              onPress={() => router.push(`/(app)/trip/${trip.id}`)}
            />
          );
        })}
        {/* A stepper, not a sheet: describing a trip for the first time is a walk through
            ten questions, and a bottom sheet is the wrong room for that. */}
        <AddRow label="New trip" onPress={() => router.push('/(app)/trip/new')} />
      </View>

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

      <View style={{ padding: t.space.lg }}>
        <Button
          label="Design system"
          variant="ghost"
          onPress={() => router.push('/(app)/design')}
        />
      </View>

      <SignInSheet
        visible={signingIn}
        // Read NOW, while this is still the guest's own session. Afterwards the hook returns the
        // account's household, and the guest's own person can't be identified at all — a linked
        // guest's profile isn't readable, so nothing on the row says which person was you.
        guest={householdId ? { household: householdId, person: personId } : undefined}
        onClose={() => setSigningIn(false)}
        onSignedIn={({ stranded: left }) => {
          setSigningIn(false);
          // Held, not written. The signed-in user's profile hasn't been queried yet — writing now
          // would stamp the GUEST's profile, which is the one the app is about to stop reading.
          setStranded(left);
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
