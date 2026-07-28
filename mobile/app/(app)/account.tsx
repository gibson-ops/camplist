import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { db } from '../../lib/db';
import { useHousehold, useSession, useStrandedRecorder, signOut } from '../../lib/useSession';
import { accountLabel, initialsOf } from '../../lib/identity';
import { renameHousehold } from '../../lib/trips';
import { SignInSheet } from '../../components/SignInSheet';
import { NameSheet } from '../../components/NameSheet';
import {
  Avatar,
  Button,
  Chevron,
  NavRow,
  Screen,
  SectionHeader,
  Text,
  useTheme,
} from '../../design';

/**
 * The account: who you are here, and the two things you can do about it.
 *
 * Reachable from the avatar on every list screen, INCLUDING while still a guest. That's the
 * point of it: the ask to finish signing up needs somewhere permanent to live, or it depends on
 * a card that scrolls away and never comes back.
 *
 * Signing out is deliberately blunt about the consequence. For an account it's reversible and
 * ordinary; for a guest it is the end of the data, because a guest has no way back in — no
 * email, no password, nothing to prove the session was theirs. Those are different actions and
 * they must not share a sentence.
 */
export default function AccountScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user, isGuest } = useSession();
  const { householdId, profileId, pendingMerge } = useHousehold(user?.id);
  const [signingIn, setSigningIn] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const recordStranded = useStrandedRecorder(profileId, pendingMerge);

  const { data } = db.useQuery(
    householdId && profileId
      ? {
          households: { $: { where: { id: householdId } } },
          profiles: { $: { where: { id: profileId } } },
        }
      : null,
  );

  const household = data?.households?.[0];
  const profile = data?.profiles?.[0];
  const email = (user as { email?: string } | undefined)?.email;

  // Mirrors the avatar in the header exactly: a real mark only once there's a real account.
  const initials = isGuest ? undefined : initialsOf(profile?.name);

  if (!householdId) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={t.color.signal} />
      </View>
    );
  }

  return (
    <Screen contentStyle={{ gap: t.space.lg }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
        accessibilityRole="button"
        accessibilityLabel="Back"
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
        <Text variant="label" tone="muted">
          Back
        </Text>
      </Pressable>

      <View
        style={{
          paddingHorizontal: t.space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.md,
        }}
      >
        <Avatar initials={initials} imageUrl={profile?.avatarUrl} label="Your account" size={56} />
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text variant="headline" numberOfLines={1}>
            {household?.name ?? 'My household'}
          </Text>
          <Text variant="body" tone="muted" numberOfLines={1}>
            {accountLabel({ email, name: profile?.name, isGuest })}
          </Text>
        </View>
      </View>

      {isGuest ? (
        <View style={{ paddingHorizontal: t.space.lg, gap: t.space.sm }}>
          <Text variant="body" tone="muted">
            Everything you&rsquo;ve packed lives on this device only. Finish signing up and it
            follows you to any other one — and lets you share a household later.
          </Text>
          <Button label="Finish signing up" onPress={() => setSigningIn(true)} full />
        </View>
      ) : null}

      <View>
        <SectionHeader title="Household" />
        <View style={{ backgroundColor: t.color.surface }}>
          <NavRow
            title="Name"
            meta={household?.name ?? 'My household'}
            isLast
            onPress={() => setRenaming(true)}
          />
        </View>
      </View>

      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.xs }}>
        {/* A guest signing out is not signing out — it's throwing the data away, because there
            is nothing to sign back IN with. Saying "Sign out" to them would be a lie by
            omission, so they get a different sentence and a confirmation. */}
        {isGuest ? (
          <Text variant="caption" tone="muted">
            You can&rsquo;t sign out yet — without an account there would be no way back to these
            trips.
          </Text>
        ) : (
          <Button
            label="Sign out"
            variant="ghost"
            onPress={() => signOut().then(() => router.replace('/(app)'))}
            full
          />
        )}
      </View>

      <SignInSheet
        visible={signingIn}
        guest={householdId ? { household: householdId } : undefined}
        onClose={() => setSigningIn(false)}
        onSignedIn={({ stranded: left }) => {
          setSigningIn(false);
          recordStranded(left);
        }}
      />

      <NameSheet
        visible={renaming}
        title="Household name"
        placeholder="The Gibsons"
        initialValue={household?.name ?? ''}
        onSubmit={(name) => householdId && renameHousehold(householdId, name)}
        onClose={() => setRenaming(false)}
      />
    </Screen>
  );
}
