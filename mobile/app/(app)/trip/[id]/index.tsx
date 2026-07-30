import { useEffect, useMemo, useState } from 'react';
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
  setItemChecked,
  deleteItem,
  setListExpanded,
  updateItem,
  type PackState,
} from '../../../../lib/trips';
import { axesOf, tripSummary } from '../../../../lib/tripMeta';
import { checkPrompt } from '../../../../lib/checkReasons';
import { isContentChecked } from '../../../../lib/kitChecks';
import { applyOrder, packOrder } from '../../../../lib/packOrder';
import { useResortSignal } from '../../../../lib/useFrozenOrder';
import { dismissedNames, type ItemSeed } from '../../../../lib/itemSeeds';
import { namesOnList, suggestFor } from '../../../../lib/suggest';
import { isFinished, needsAnswer, verdictsFrom } from '../../../../lib/reflections';
import { shapeOf } from '../../../../lib/similarity';
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
          // silences it everywhere, which needs every trip's dismissals to count them. The rest
          // come along for the same reason — a note is scoped by the SHAPE of the trip it came
          // from, not by which trip you happen to be looking at.
          reflections: { $: { where: { householdId } }, trip: {}, item: {} },
        }
      : null,
  );

  /**
   * The rest of the household's trips, loaded only while the add sheet is open.
   *
   * Every trip with every list and every item is a much bigger read than this screen otherwise
   * needs, and this is the screen you open constantly — standing in the garage, one-handed,
   * checking things off. Suggestions are the one feature that wants the whole history, they only
   * appear inside the sheet, and they sit below the fold when they do. So the cost is paid at the
   * moment it buys something.
   */
  const { data: history } = db.useQuery(
    addTarget?.kind === 'item' && householdId
      ? {
          trips: {
            $: { where: { householdId } },
            attendees: {},
            lists: { owner: {}, items: { group: {} } },
          },
        }
      : null,
  );

  const trip = data?.trips?.[0];

  /**
   * Re-sorts on arrival and whenever you come back to the app — never while you are working.
   *
   * Ticking something changes its state but not the FROZEN order, so the row stays exactly where
   * it was. Re-sorting live is what makes a row leave the screen mid-tap and takes your place with
   * it, which on a long list is the whole problem. See lib/packOrder.ts.
   */
  const resortSignal = useResortSignal();

  const rawLists = useMemo(
    () =>
      [...(trip?.lists ?? [])]
        // Return lists are a separate mode, not a section mixed in with what to bring.
        .filter((l) => l.kind === 'outbound')
        .sort(byOrder)
        .map((list) => ({ ...list, items: [...(list.items ?? [])].sort(byOrder) })),
    [trip?.lists],
  );

  // One frozen order per list, recomputed only when the signal ticks. Sorting stays INSIDE a list:
  // across them, a packed item would leave Brooke's section and appear in Walker's.
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  useEffect(() => {
    setOrders(Object.fromEntries(rawLists.map((list) => [list.id, packOrder(list.items)])));
    // Deliberately NOT keyed on the items themselves: recomputing when they change is exactly the
    // live re-sort this avoids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resortSignal, trip?.id]);

  const lists = useMemo(
    () =>
      rawLists.map((list) => ({
        ...list,
        items: orders[list.id] ? applyOrder(list.items, orders[list.id]) : list.items,
      })),
    [rawLists, orders],
  );

  /** People who joined the household after this trip was seeded, so they have no list yet. */
  const peopleWithoutLists = useMemo(() => {
    const owned = new Set(lists.map((l) => l.owner?.id).filter(Boolean));
    return [...(data?.people ?? [])]
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      .filter((p) => !owned.has(p.id));
  }, [data?.people, lists]);

  const allItems = useMemo(() => lists.flatMap((l) => l.items), [lists]);

  const dismissals = useMemo(
    () => (data?.reflections ?? []).filter((r) => r.kind === 'dismissed'),
    [data?.reflections],
  );

  /**
   * Whether to offer the post-trip questions.
   *
   * Three conditions, and the third is the one that keeps this from nagging. The trip has to be
   * over, it has to have something left unanswered, and nobody can have answered already — a
   * prompt that reappears after you've dealt with it teaches people to ignore it.
   */
  const askable =
    trip !== undefined &&
    isFinished(trip) &&
    needsAnswer(lists).length > 0 &&
    !(data?.reflections ?? []).some((r) => r.trip?.id === trip.id && r.kind !== 'dismissed');
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
   * Drawn from what past trips of the same shape actually packed, falling back to the trip's own
   * tags where the household has no history to read. Nothing is added automatically: a list that
   * arrives pre-filled with guesses stops being read.
   */
  const suggestions = useMemo(() => {
    if (!trip || addTarget?.kind !== 'item') return [];
    return suggestFor({
      trip,
      past: history?.trips ?? [],
      onList: namesOnList(allItems),
      dismissed: dismissedNames(dismissals, trip.id),
      verdicts: verdictsFrom({
        reflections: data?.reflections ?? [],
        current: shapeOf(trip),
        past: history?.trips ?? [],
      }),
      // Each list only offers what belongs on it. A cooler is nobody's in particular, so it
      // goes on the shared list; a sleeping bag is something each of you brings your own of,
      // so it goes on yours. Neither belongs on the other.
      sharing: addTarget.shared ? 'one' : 'each',
    });
  }, [trip, history?.trips, allItems, data?.reflections, dismissals, addTarget]);

  /** Kit contents are nested, so a tapped child has to be findable without walking the tree. */
  const childIndex = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        note?: string;
        consumable: boolean;
        checkReason?: string | null;
        oneOff?: boolean;
      }
    >();
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

  function onAdd(name: string, checked: boolean, reason?: string) {
    if (!addTarget || !householdId) return;
    if (addTarget.kind === 'content') {
      addKitContent({
        parentId: addTarget.parentId,
        householdId,
        name,
        consumable: checked,
        checkReason: reason,
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
    if (checked) {
      // A kit with nothing in it is nothing, so making one is a statement of intent to fill it.
      // Aim the sheet inside instead of leaving it pointed at the list: the alternative is
      // closing, finding the row you just wrote, and opening it again to do the obvious next
      // thing. The check row becomes "Needs checking" plus its reasons on the way, which is the
      // modifier that actually matters in a box.
      const kitItemId = addKit(args);
      setAddTarget({ kind: 'content', parentId: kitItemId, kitName: name, nextOrder: 0 });
      return;
    }
    addItem({ ...args, shared: addTarget.shared });
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

      {/* The one moment the app can learn something history can't tell it. Offered rather than
          forced, and only once there's something to answer: a trip that came back fully ticked
          with nothing left over has already told the app everything it needs. */}
      {askable ? (
        <Pressable
          onPress={() => router.push(`/(app)/trip/${trip.id}/reflect`)}
          accessibilityRole="button"
          accessibilityLabel="How did it go? Answer a couple of questions to improve the next list"
          style={({ pressed }) => ({
            marginHorizontal: t.space.lg,
            marginBottom: t.space.sm,
            padding: t.space.md,
            borderRadius: t.radius.sm,
            backgroundColor: t.color.raised,
            gap: 2,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text variant="title">How did it go?</Text>
          <Text variant="caption" tone="muted">
            A couple of questions, and the next list gets better.
          </Text>
        </Pressable>
      ) : null}

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
                        // The screen words it; the design system just renders it. See ItemRow.
                        checked: isContentChecked(c),
                        // Stated once answered, asked while open. The wording lives in
                        // lib/checkReasons.ts; the answer in lib/kitChecks.ts.
                        checkLabel: checkPrompt(c, isContentChecked(c)),
                        note: c.note,
                      }))}
                      expanded={Boolean(openKits[item.id])}
                      onToggle={() =>
                        setOpenKits((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      onAdvance={() => advanceItem(item.id, item.state as PackState)}
                      onChildAdvance={(childId) => {
                        const child = (item.children ?? []).find((c) => c.id === childId);
                        // Recorded explicitly rather than nudged through `state`: untouched-and-fine
                        // and deliberately-flagged are the same `unpacked` otherwise. See
                        // lib/kitChecks.ts.
                        if (child) setItemChecked(child.id, !isContentChecked(child));
                      }}
                      onChildPress={(childId) => {
                        const child = childIndex.get(childId);
                        if (!child) return;
                        setEditing({
                          id: child.id,
                          name: child.name,
                          note: child.note,
                          consumable: child.consumable,
                          checkReason: child.checkReason ?? undefined,
                          oneOff: Boolean(child.oneOff),
                          sharing: 'one',
                          shared: false,
                          isKit: false,
                          // A kit's child: the one place the consumable flag does anything.
                          nested: true,
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
                      onAdvance={() => advanceItem(item.id, item.state as PackState)}
                      onPress={() =>
                        setEditing({
                          id: item.id,
                          name: item.name,
                          note: item.note,
                          consumable: item.consumable,
                          checkReason: item.checkReason ?? undefined,
                          oneOff: Boolean(item.oneOff),
                          sharing: item.sharing,
                          shared: !list.owner,
                          isKit: false,
                          nested: false,
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
        /**
         * What is already where this is going, so the same thing can't be added twice.
         *
         * Scoped to the destination rather than the whole trip: a kit's contents and the list it
         * sits on are different places, and "Matches" in the camp kitchen has nothing to say about
         * "Matches" on the shared list.
         */
        duplicateLabel={
          addTarget?.kind === 'content' ? 'Already in the kit' : 'Already in the list'
        }
        existing={
          addTarget?.kind === 'content'
            ? (allItems.find((i) => i.id === addTarget.parentId)?.children ?? []).map((c) => c.name)
            : (lists.find((l) => l.id === addTarget?.listId)?.items ?? []).map((i) => i.name)
        }
        title={
          addTarget?.kind === 'content' ? `Into ${addTarget.kitName}` : (addTarget?.listName ?? '')
        }
        // Describes rather than exemplifies: the suggestion chips below are real items, and
        // an example in the field reads as one of them.
        placeholder={addTarget?.kind === 'content' ? 'Propane' : 'Something to bring'}
        check={
          addTarget?.kind === 'content'
            ? {
                // Same control as the edit sheet, so the two cannot drift apart again.
                reasons: true,
                label: 'Needs checking',
                hint: 'Gets checked when you pack the kit, instead of just counted',
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
