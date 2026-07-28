import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { db } from '../../../../lib/db';
import { useHousehold, useSession } from '../../../../lib/useSession';
import { isExpanded } from '../../../../lib/listPrefs';
import {
  addItem,
  addKit,
  addKitContent,
  addListForPerson,
  addSuggestedItem,
  advanceItem,
  deleteItem,
  setListExpanded,
  updateItem,
  type PackState,
} from '../../../../lib/trips';
import { axesOf, parseTags, tripSummary } from '../../../../lib/tripMeta';
import { dismissedNames, suggestItems, type ItemSeed } from '../../../../lib/itemSeeds';
import { AddItemSheet } from '../../../../components/AddItemSheet';
import { ItemSheet, type EditableItem } from '../../../../components/ItemSheet';
import {
  AddRow,
  Chevron,
  EmptyState,
  ItemRow,
  KitRow,
  Screen,
  SectionHeader,
  Text,
  useTheme,
} from '../../../../design';

/** What the add sheet is currently pointed at. */
type AddTarget =
  | { kind: 'item'; listId: string; listName: string; shared: boolean; nextOrder: number }
  | { kind: 'content'; parentId: string; kitName: string; nextOrder: number };

/**
 * The trip screen: one section per list, one row per thing.
 *
 * The organizing claim is that a list belongs to a PERSON, which is why no row carries an
 * avatar — on Brooke's list everything is Brooke's, and repeating that on every line is
 * noise. Sections collapse so a four-person trip stays scannable, and a collapsed section
 * still shows its own count, so someone else's list is condensed rather than hidden.
 */
export default function TripScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { householdId, profileId, personId, listPrefs } = useHousehold(user?.id);

  const [openKits, setOpenKits] = useState<Record<string, boolean>>({});
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [editing, setEditing] = useState<EditableItem | null>(null);

  const { data, isLoading, error } = db.useQuery(
    tripId && householdId
      ? {
          trips: {
            $: { where: { id: tripId } },
            attendees: {},
            lists: { owner: {}, items: { children: {}, group: {} } },
          },
          people: { $: { where: { householdId } } },
          // Household-wide, not trip-scoped: turning the same suggestion down on a second trip
          // silences it everywhere, which needs every trip's dismissals to count them.
          reflections: { $: { where: { householdId, kind: 'dismissed' } }, trip: {} },
        }
      : null,
  );

  const trip = data?.trips?.[0];

  const lists = useMemo(
    () =>
      [...(trip?.lists ?? [])]
        // Return lists are a separate mode, not a section mixed in with what to bring.
        .filter((l) => l.kind === 'outbound')
        .sort(byOrder)
        .map((list) => ({ ...list, items: [...(list.items ?? [])].sort(byOrder) })),
    [trip?.lists],
  );

  /** People who joined the household after this trip was seeded, so they have no list yet. */
  const peopleWithoutLists = useMemo(() => {
    const owned = new Set(lists.map((l) => l.owner?.id).filter(Boolean));
    return [...(data?.people ?? [])]
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      .filter((p) => !owned.has(p.id));
  }, [data?.people, lists]);

  const allItems = useMemo(() => lists.flatMap((l) => l.items), [lists]);
  const packed = allItems.filter((i) => i.state !== 'unpacked').length;

  const summary = tripSummary({
    destination: trip?.destination,
    departAt: trip?.departAt,
    returnAt: trip?.returnAt,
    lodgings: trip ? axesOf(trip).lodgings : undefined,
    attendeeCount: trip?.attendees?.length,
  });

  /**
   * What this trip probably needs and hasn't got.
   *
   * Derived from the trip's own tags — every chip picked on the details screen turns into gear
   * here, which is the payoff the metadata was collected for. Nothing is added automatically:
   * a list that arrives pre-filled with guesses stops being read.
   */
  const suggestions = useMemo(() => {
    if (!trip || addTarget?.kind !== 'item') return [];
    const axes = axesOf(trip);
    return suggestItems({
      tags: [
        ...axes.tripTypes,
        ...axes.travelModes,
        ...axes.lodgings,
        ...parseTags(trip.activities),
        ...parseTags(trip.conditions),
      ],
      onList: allItems.map((item) => item.name),
      dismissed: dismissedNames(data?.reflections ?? [], trip.id),
      // Each list only offers what belongs on it. A cooler is nobody's in particular, so it
      // goes on the shared list; a sleeping bag is something each of you brings your own of,
      // so it goes on yours. Neither belongs on the other.
      sharing: addTarget.shared ? 'one' : 'each',
    });
  }, [trip, allItems, data?.reflections, addTarget]);

  /** Kit contents are nested, so a tapped child has to be findable without walking the tree. */
  const childIndex = useMemo(() => {
    const map = new Map<string, { id: string; name: string; note?: string; consumable: boolean }>();
    for (const item of allItems) for (const c of item.children ?? []) map.set(c.id, c);
    return map;
  }, [allItems]);

  function toggleList(list: (typeof lists)[number], currentlyExpanded: boolean) {
    if (!profileId) return;
    setListExpanded({
      profileId,
      prefs: listPrefs,
      listId: list.id,
      expanded: !currentlyExpanded,
      ownerPersonId: list.owner?.id,
      myPersonId: personId,
    });
  }

  function onAdd(name: string, checked: boolean) {
    if (!addTarget || !householdId) return;
    if (addTarget.kind === 'content') {
      addKitContent({
        parentId: addTarget.parentId,
        householdId,
        name,
        consumable: checked,
        sortOrder: addTarget.nextOrder,
      });
      // Keep the sheet pointed past what it just wrote, so a burst of adds stays in order.
      setAddTarget({ ...addTarget, nextOrder: addTarget.nextOrder + 1 });
      return;
    }

    const args = {
      listId: addTarget.listId,
      householdId,
      name,
      sortOrder: addTarget.nextOrder,
    };
    if (checked) addKit(args);
    else addItem({ ...args, shared: addTarget.shared });
    setAddTarget({ ...addTarget, nextOrder: addTarget.nextOrder + 1 });
  }

  if (isLoading || !householdId) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={t.color.signal} />
      </View>
    );
  }

  if (!trip) {
    return (
      <Screen>
        <EmptyState
          title="That trip is gone."
          body="It may have been deleted on another device."
          actionLabel="Back to trips"
          onAction={() => router.replace('/(app)')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
        accessibilityRole="button"
        accessibilityLabel="Back to trips"
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
          Trips
        </Text>
      </Pressable>

      {/* The header is the way into the trip's metadata, and the summary underneath is the
          receipt for filling it in. A trip that hasn't been described says so in the same
          place, because an undescribed trip is one the suggestion engine can't help with. */}
      <Pressable
        onPress={() => router.push(`/(app)/trip/${trip.id}/edit`)}
        accessibilityRole="button"
        accessibilityLabel={`${trip.name}. ${summary || 'Not described yet'}. Edit trip details`}
        style={({ pressed }) => ({
          paddingHorizontal: t.space.lg,
          paddingBottom: t.space.xs,
          gap: t.space.xs,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.md }}>
          <Text variant="display" style={{ flex: 1 }} numberOfLines={2}>
            {trip.name}
          </Text>
          <Text variant="numeric" tone="muted">
            {allItems.length > 0 ? `${packed}/${allItems.length}` : '—'}
          </Text>
        </View>
        <Text variant="body" tone="muted" numberOfLines={2}>
          {summary || "Add who's going, where, and when →"}
        </Text>
      </Pressable>

      {lists.map((list) => {
        const expanded = isExpanded(list.id, list.owner?.id, personId, listPrefs);
        const done = list.items.filter((i) => i.state !== 'unpacked').length;
        const nextOrder = maxOrder(list.items) + 1;

        return (
          <View key={list.id}>
            <SectionHeader
              title={list.name}
              count={list.items.length > 0 ? `${done}/${list.items.length}` : undefined}
              expanded={expanded}
              onToggle={() => toggleList(list, expanded)}
            />

            {expanded ? (
              <View style={{ backgroundColor: t.color.surface }}>
                {list.items.map((item) =>
                  item.group ? (
                    <KitRow
                      key={item.id}
                      name={item.name}
                      state={item.state as PackState}
                      contents={(item.children ?? []).sort(byOrder).map((c) => ({
                        id: c.id,
                        name: c.name,
                        state: c.state as PackState,
                        consumable: c.consumable,
                        note: c.note,
                      }))}
                      expanded={Boolean(openKits[item.id])}
                      onToggle={() =>
                        setOpenKits((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      onAdvance={() => advanceItem(item.id, item.state as PackState)}
                      onChildAdvance={(childId) => {
                        const child = (item.children ?? []).find((c) => c.id === childId);
                        if (child) advanceItem(child.id, child.state as PackState);
                      }}
                      onChildPress={(childId) => {
                        const child = childIndex.get(childId);
                        if (!child) return;
                        setEditing({
                          id: child.id,
                          name: child.name,
                          note: child.note,
                          consumable: child.consumable,
                          sharing: 'one',
                          shared: false,
                          isKit: false,
                          childCount: 0,
                        });
                      }}
                      onAdd={() =>
                        setAddTarget({
                          kind: 'content',
                          parentId: item.id,
                          kitName: item.name,
                          nextOrder: maxOrder(item.children ?? []) + 1,
                        })
                      }
                    />
                  ) : (
                    <ItemRow
                      key={item.id}
                      name={item.name}
                      state={item.state as PackState}
                      note={item.note}
                      qty={item.qty}
                      // `sharing` only disambiguates on the shared list; see instant.schema.ts.
                      each={!list.owner && item.sharing === 'each'}
                      consumable={item.consumable}
                      onAdvance={() => advanceItem(item.id, item.state as PackState)}
                      onPress={() =>
                        setEditing({
                          id: item.id,
                          name: item.name,
                          note: item.note,
                          consumable: item.consumable,
                          sharing: item.sharing,
                          shared: !list.owner,
                          isKit: false,
                          childCount: 0,
                        })
                      }
                    />
                  ),
                )}

                <AddRow
                  label={list.items.length === 0 ? 'Add the first thing' : 'Add item'}
                  onPress={() =>
                    setAddTarget({
                      kind: 'item',
                      listId: list.id,
                      listName: list.name,
                      shared: !list.owner,
                      nextOrder,
                    })
                  }
                />
              </View>
            ) : null}

          </View>
        );
      })}

      {peopleWithoutLists.length > 0 ? (
        <>
          <SectionHeader title="Not on this trip" />
          <View style={{ backgroundColor: t.color.surface }}>
            {peopleWithoutLists.map((person, i) => (
              <AddRow
                key={person.id}
                label={`Add ${person.name}'s list`}
                isLast={i === peopleWithoutLists.length - 1}
                onPress={() =>
                  householdId &&
                  addListForPerson({
                    tripId: trip.id,
                    householdId,
                    person,
                    sortOrder: lists.length,
                  })
                }
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

      <AddItemSheet
        visible={Boolean(addTarget)}
        title={
          addTarget?.kind === 'content' ? `Into ${addTarget.kitName}` : (addTarget?.listName ?? '')
        }
        // Describes rather than exemplifies: the suggestion chips below are real items, and
        // an example in the field reads as one of them.
        placeholder={addTarget?.kind === 'content' ? 'Propane' : 'Something to bring'}
        check={
          addTarget?.kind === 'content'
            ? {
                label: 'Runs out',
                hint: 'Has to be checked before the box counts as packed',
                stickyCheck: true,
              }
            : { label: 'This is a box or kit', hint: 'Holds its own list of contents' }
        }
        suggestions={suggestions}
        onAdd={onAdd}
        onSuggestion={(seed: ItemSeed) => {
          if (!addTarget || addTarget.kind !== 'item' || !householdId) return;
          addSuggestedItem({
            listId: addTarget.listId,
            householdId,
            name: seed.name,
            // On a personal list `sharing` is inert, and 'each' is literally true of it.
            sharing: addTarget.shared ? (seed.sharing ?? 'one') : 'each',
            consumable: seed.consumable,
            sortOrder: addTarget.nextOrder,
          });
          setAddTarget({ ...addTarget, nextOrder: addTarget.nextOrder + 1 });
        }}
        onClose={() => setAddTarget(null)}
      />

      <ItemSheet
        item={editing}
        onSave={(patch) => editing && updateItem(editing.id, patch)}
        onDelete={() => editing && deleteItem(editing.id)}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}

/** sortOrder first, creation time as the tiebreak so concurrent adds stay stable. */
function byOrder(
  a: { sortOrder?: number | null; createdAt: Date | string },
  b: { sortOrder?: number | null; createdAt: Date | string },
) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || +new Date(a.createdAt) - +new Date(b.createdAt);
}

function maxOrder(rows: { sortOrder?: number | null }[]) {
  return rows.reduce((max, r) => Math.max(max, r.sortOrder ?? 0), -1);
}
