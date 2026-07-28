import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { db } from '../../lib/db';
import { useHousehold, useSession } from '../../lib/useSession';
import { addPerson, createTrip, renamePerson } from '../../lib/trips';
import { tripSummary } from '../../lib/tripMeta';
import { NameSheet } from '../../components/NameSheet';
import { NewTripSheet } from '../../components/NewTripSheet';
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
  const { user } = useSession();
  const { householdId, isReady } = useHousehold(user?.id);

  const [newTrip, setNewTrip] = useState(false);
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

  async function onCreateTrip(name: string, attendees: { id: string; name: string }[]) {
    if (!householdId) return;
    const tripId = await createTrip({ householdId, name, attendees });
    router.push(`/(app)/trip/${tripId}`);
  }

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
        <AddRow label="New trip" onPress={() => setNewTrip(true)} />
      </View>

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

      <NewTripSheet
        visible={newTrip}
        people={people}
        submitLabel={isReady ? 'Create' : 'Starting…'}
        onSubmit={onCreateTrip}
        onClose={() => setNewTrip(false)}
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
