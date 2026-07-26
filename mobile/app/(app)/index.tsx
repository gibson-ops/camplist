import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { db, id } from '../../lib/db';
import { useHousehold, useSession } from '../../lib/useSession';
import { Button, Screen, SectionHeader, Text, useTheme } from '../../design';

/**
 * M0 verification screen: proves the login-free path works end to end.
 *
 *   1. A guest session exists without the user ever seeing an email field.
 *   2. That guest bootstrapped its own profile + household client-side.
 *   3. Permissioned reads AND writes run as that identity.
 *
 * Replaced by the real trip list in M1.
 */
export default function HomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user, isGuest } = useSession();
  const { householdId, profileId, isReady } = useHousehold(user?.id);

  // Round-trips through the CEL rules, so a result here proves permissions accept us.
  const { data, error } = db.useQuery(
    householdId ? { trips: { $: { where: { householdId } } }, people: { $: { where: { householdId } } } } : null,
  );

  /** Writes a throwaway trip to prove the guest can actually create household-scoped data. */
  function addTrip() {
    if (!householdId) return;
    const now = new Date();
    db.transact(
      db.tx.trips[id()]
        .update({
          name: `Trip ${(data?.trips?.length ?? 0) + 1}`,
          status: 'planning',
          isTemplate: false,
          householdId,
          createdAt: now,
        })
        .link({ household: householdId }),
    );
  }

  return (
    <Screen>
      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.sm }}>
        <Text variant="display">Camp List</Text>
        <Text variant="body" tone="muted">
          No sign-in required. This is a guest session syncing to the cloud.
        </Text>
      </View>

      <SectionHeader title="Session" />
      <Group>
        <Row label="auth.id" value={user?.id ?? '—'} ok={Boolean(user?.id)} />
        <Row label="kind" value={isGuest ? 'guest' : 'account'} ok={Boolean(user)} last />
      </Group>

      <SectionHeader title="Household bootstrap" />
      <Group>
        <Row label="profile" value={profileId ? 'created' : 'pending'} ok={Boolean(profileId)} />
        <Row label="household" value={householdId ? 'created' : 'pending'} ok={isReady} />
        <Row label="people" value={String(data?.people?.length ?? 0)} last />
      </Group>

      <SectionHeader title="Permissioned write" count={String(data?.trips?.length ?? 0)} />
      <Group>
        {(data?.trips ?? []).map((trip, i, arr) => (
          <Row key={trip.id} label={trip.name} value={trip.status} last={i === arr.length - 1} />
        ))}
        {(data?.trips?.length ?? 0) === 0 ? (
          <Row label="trips" value="none yet" last />
        ) : null}
      </Group>

      {error ? (
        <View style={{ paddingHorizontal: t.space.lg, paddingTop: t.space.sm }}>
          <Text variant="body" tone="danger">
            {String((error as { message?: string }).message ?? error)}
          </Text>
        </View>
      ) : null}

      <View style={{ padding: t.space.lg, gap: t.space.md }}>
        <Button label="Add a trip" onPress={addTrip} disabled={!isReady} full />
        <Button
          label="Design system"
          variant="secondary"
          onPress={() => router.push('/(app)/design')}
          full
        />
      </View>
    </Screen>
  );
}

/** Grouped rows on one surface, the pattern that replaces cards throughout the app. */
function Group({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.color.surface,
        borderRadius: t.radius.sm,
        marginHorizontal: t.space.lg,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  ok,
  last = false,
}: {
  label: string;
  value: string;
  ok?: boolean;
  last?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: t.space.md,
        minHeight: t.touch.floor,
        paddingHorizontal: t.space.lg,
        paddingVertical: t.space.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.color.border,
      }}
    >
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Text
        variant="numeric"
        tone={ok === true ? 'loaded' : ok === false ? 'danger' : 'default'}
        numberOfLines={1}
        style={{ flexShrink: 1 }}
      >
        {value}
      </Text>
    </View>
  );
}
