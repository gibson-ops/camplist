import { useAuth, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { db } from '../../lib/db';
import { signOutEverywhere, useInstantClerkAuth } from '../../lib/useInstantClerkAuth';
import { Button, SectionHeader, Text, useTheme } from '../../design';

/**
 * M0 spike screen. Its only job is to prove the Clerk → InstantDB bridge end-to-end:
 *   1. Clerk holds a session.
 *   2. Instant minted its OWN session from Clerk's id token (auth.id + matching email).
 *   3. Permissioned queries run as that Instant identity.
 *
 * Replaced by the real trip list in M1.
 */
export default function SpikeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const { instantUser, error } = useInstantClerkAuth();

  // Runs under the CEL rules — proves permissions are live, not that data exists.
  const { data, isLoading, error: queryError } = db.useQuery({
    profiles: { households: {}, $user: {} },
  });

  const profile = data?.profiles?.[0];
  const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ paddingTop: 64, paddingBottom: t.space.xxl }}
    >
      <View style={{ paddingHorizontal: t.space.lg }}>
        <Text variant="headline">Clerk → Instant bridge</Text>
      </View>

      <SectionHeader title="1 · Clerk session" />
      <Group>
        <Row label="signed in" value={clerkUser ? 'yes' : 'no'} ok={Boolean(clerkUser)} />
        <Row label="email" value={clerkEmail ?? '—'} last />
      </Group>

      <SectionHeader title="2 · Instant session" />
      <Group>
        <Row label="auth.id" value={instantUser?.id ?? '—'} ok={Boolean(instantUser?.id)} />
        <Row label="email" value={instantUser?.email ?? '—'} ok={Boolean(instantUser?.email)} />
        <Row
          label="emails match"
          value={instantUser?.email && clerkEmail ? String(instantUser.email === clerkEmail) : '—'}
          ok={Boolean(instantUser?.email) && instantUser?.email === clerkEmail}
          last
        />
      </Group>
      {error ? (
        <View style={{ paddingHorizontal: t.space.lg, paddingTop: t.space.sm }}>
          <Text variant="body" tone="danger">
            {String((error as { message?: string }).message ?? error)}
          </Text>
        </View>
      ) : null}

      <SectionHeader title="3 · Permissioned query" />
      <Group>
        <Row
          label="status"
          value={isLoading ? 'loading' : queryError ? 'error' : 'ok'}
          ok={!queryError && !isLoading}
        />
        <Row label="profile" value={profile ? profile.name : 'none yet'} />
        <Row label="households" value={String(profile?.households?.length ?? 0)} last />
      </Group>

      <View style={{ padding: t.space.lg, gap: t.space.md }}>
        <Text variant="body" tone="muted">
          No profile row is expected until the household bootstrap runs. The rules make
          profile and membership writes server-only on purpose.
        </Text>

        <Button label="Design system" variant="secondary" onPress={() => router.push('/(app)/design')} full />
        <Button label="Sign out" variant="ghost" onPress={() => signOutEverywhere(signOut)} full />
      </View>
    </ScrollView>
  );
}

/** Grouped rows on one surface, the pattern that replaces cards throughout the app. */
function Group({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.color.surface, borderRadius: t.radius.sm, marginHorizontal: t.space.lg, overflow: 'hidden' }}>
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
