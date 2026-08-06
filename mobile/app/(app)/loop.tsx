import { useMemo } from 'react';
import { View } from 'react-native';
import { db } from '../../lib/db';
import { useHousehold, useSession } from '../../lib/useSession';
import { replayAll, totals } from '../../lib/loopMetrics';
import { BackLink, Screen, SectionHeader, Text, useTheme } from '../../design';

/**
 * Did the app know what you were going to need?
 *
 * NOT LINKED FROM ANYWHERE, and reached by typing `/loop`. This is an instrument rather than a
 * feature: it reads the learning loop's own accuracy, which is a thing the two people tuning it
 * need and a thing a user of a packing app has no reason to see. Wiring it into the navigation
 * would make it a screen the product has to justify, and it can't.
 *
 * Every number is a replay — see `lib/loopMetrics.ts`. Nothing here is stored; it is recomputed
 * from what existed before each trip, which is what makes it comparable across changes to the
 * matcher. Change a weight, reload this, read the difference.
 */
export default function LoopScreen() {
  const t = useTheme();
  const { user } = useSession();
  const { householdId } = useHousehold(user?.id);

  const { data, isLoading } = db.useQuery(
    householdId
      ? {
          trips: {
            $: { where: { householdId } },
            attendees: {},
            lists: { owner: {}, items: { group: {} } },
          },
          reflections: { $: { where: { householdId } }, trip: {}, item: {} },
        }
      : null,
  );

  const replays = useMemo(
    () => replayAll({ trips: data?.trips ?? [], reflections: data?.reflections ?? [] }),
    [data?.trips, data?.reflections],
  );
  const all = totals(replays);

  const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);

  return (
    <Screen>
      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.lg }}>
        <BackLink label="TRIPS" onPress={() => history.back()} />

        <View style={{ gap: t.space.xs }}>
          <Text variant="headline">The learning loop</Text>
          <Text variant="body" tone="muted">
            What the app would have suggested for each trip, using only what it knew before that
            trip existed. Nothing here is recorded — it is replayed, so the same numbers can be read
            again after a change.
          </Text>
        </View>

        {isLoading ? <Text tone="muted">Reading every trip…</Text> : null}

        {!isLoading && !replays.length ? (
          <Text tone="muted">
            Nothing to replay yet. A trip needs something on its list before it can say whether the
            app guessed it.
          </Text>
        ) : null}

        {replays.length ? (
          <View style={{ gap: t.space.sm }}>
            <SectionHeader title="ACROSS EVERY TRIP" />
            {/* Missed leads. The app exists to stop you forgetting, so what you had to remember
                unaided is the gap it was built to close — coverage is the same fact stated kindly,
                and ignored is the counterweight that stops "suggest everything" from winning. */}
            <Stat label="Had to think of yourself" value={String(all.missed)} t={t} loud />
            <Stat label="It named for you" value={`${all.taken}  (${pct(all.coverage)})`} t={t} />
            <Stat label="Offered, never taken" value={String(all.ignored)} t={t} />
            <Stat label="Trips replayed" value={String(all.trips)} t={t} />
          </View>
        ) : null}

        {replays.map((r) => (
          <View key={r.tripId} style={{ gap: t.space.sm }}>
            <SectionHeader title={r.name.toUpperCase()} />

            <Stat
              label="Missed"
              value={`${r.missed.length}  of ${r.missed.length + r.taken.length}`}
              t={t}
              loud={r.missed.length > 0}
            />

            {/* The list, not just the count. "You added a water filter and we never said a word"
                is the sentence that tells you what to fix; a number only tells you to worry. */}
            {r.missed.length ? (
              <Text variant="body" tone="muted">
                {r.missed
                  .map((name) => {
                    if (r.kits.includes(name)) return `${name} (a kit — never suggested)`;
                    if (r.oneOffs.includes(name)) return `${name} (one-off)`;
                    return name;
                  })
                  .join(' · ')}
              </Text>
            ) : null}

            {r.regrets.length ? (
              <>
                <Stat label="Wished for afterwards" value={String(r.regrets.length)} t={t} loud />
                <Text variant="body" tone="muted">
                  {r.regrets.join(' · ')}
                </Text>
              </>
            ) : null}

            <Stat label="Offered, never taken" value={String(r.ignored.length)} t={t} />
          </View>
        ))}

        <View style={{ height: t.space.xl }} />
      </View>
    </Screen>
  );
}

/** One number and what it means, on a row. */
function Stat({
  label,
  value,
  t,
  loud = false,
}: {
  label: string;
  value: string;
  t: ReturnType<typeof useTheme>;
  loud?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.space.md }}>
      <Text variant="body" tone="muted" style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <Text variant="numeric" tone={loud ? 'default' : 'muted'}>
        {value}
      </Text>
    </View>
  );
}
