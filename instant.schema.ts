// Camp List — InstantDB schema (shared source of truth for mobile, web, and engine).
//
// Model in one breath:
//   household → people + trips → lists → items, with reusable kits and post-trip reflections.
//
// Tenancy:
//   • A HOUSEHOLD is the sharing unit (Jared + Brooke + Walker). Everything is scoped to one.
//   • A PROFILE is a login (Clerk-backed). A PERSON is who an item is FOR — Walker is a person
//     with no login, so people are deliberately NOT the same thing as profiles.
//   • Every household-scoped record carries a denormalized `householdId` string so the CEL
//     permission rules can check membership without a multi-hop graph walk, and a denormalized
//     profiles↔households link acts as the access cache those rules read.
//
// The two axes that make packing for a family work (this is the crux of the product):
//   • items.assignees  — WHICH people an item covers (empty = the whole household).
//   • items.sharing    — 'each' = every assignee needs their own (2 toothbrushes for 2 people)
//                        'one'  = a single one covers all assignees (1 tent for the family).
//   Together they express all four real cases: shared gear, per-person gear, "we each bring our
//   own", and "one of these for both of us". Effective count = sharing === 'each'
//   ? qty * max(assignees.length, 1) : qty.

import { i } from '@instantdb/core';

const _schema = i.schema({
  entities: {
    // --- system entities (InstantDB built-ins; must be declared for links to validate) ---
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
    }),

    // --- identity -------------------------------------------------------------
    // One profile per login. Auth itself lives in Clerk; this is the app-side identity,
    // bridged by email via db.auth.signInWithIdToken.
    profiles: i.entity({
      name: i.string(),
      avatarUrl: i.string().optional(),
      // Expo push token, refreshed on launch; the engine reads these to send trip reminders.
      pushToken: i.string().optional(),
      createdAt: i.date().indexed(),
    }),

    // --- tenancy --------------------------------------------------------------
    households: i.entity({
      name: i.string(),
      createdAt: i.date().indexed(),
    }),
    // profile ↔ household join. Server-only writes (invites are privileged).
    householdMembers: i.entity({
      role: i.string(), // 'owner' | 'member'
      joinedAt: i.date().indexed(),
    }),
    // Who an item can be FOR. Not every person has a login (kids), so this is its own entity.
    people: i.entity({
      name: i.string(),
      color: i.string().optional(), // UI accent so lists scan fast
      householdId: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),
    invitations: i.entity({
      email: i.string().indexed(),
      token: i.string().unique().indexed(),
      status: i.string(), // 'pending' | 'accepted' | 'revoked'
      createdAt: i.date().indexed(),
    }),

    // --- trips & lists --------------------------------------------------------
    trips: i.entity({
      name: i.string(),
      destination: i.string().optional(),
      notes: i.string().optional(),
      // When you LEAVE HOME (not a flight time) — drives the pre-departure reminder.
      departAt: i.date().indexed().optional(),
      // When you get back — drives the post-trip reflection prompt.
      returnAt: i.date().indexed().optional(),
      status: i.string().indexed(), // 'planning' | 'active' | 'archived'
      // Any trip can be reused as a starting point; templates are the explicitly curated ones.
      isTemplate: i.boolean().indexed(),
      tags: i.json().optional(), // string[] — 'car-camping', 'cold-weather', drives suggestions
      householdId: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),
    lists: i.entity({
      name: i.string(),
      // 'outbound' = what to bring · 'return' = what to re-pack so it doesn't get left behind
      kind: i.string().indexed(),
      sortOrder: i.number().optional(),
      householdId: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),
    items: i.entity({
      name: i.string(),
      note: i.string().optional(),
      qty: i.number(),
      category: i.string().indexed().optional(), // 'shelter' | 'kitchen' | 'clothing' | ...
      tags: i.json().optional(), // string[] — feeds the offline suggestion engine
      // Runs out and needs restocking (propane, garbage bags, soap).
      consumable: i.boolean().indexed(),
      // Packing progress: unpacked → packed → loaded (in the car).
      state: i.string().indexed(),
      // 'each' = every assignee brings their own · 'one' = one covers all assignees.
      sharing: i.string(),
      sortOrder: i.number().optional(),
      householdId: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),

    // --- reusable kits (the camp kitchen box) ---------------------------------
    itemGroups: i.entity({
      name: i.string(),
      description: i.string().optional(),
      tags: i.json().optional(), // string[]
      // Last time its consumables were confirmed stocked — drives the restock nudge.
      lastVerifiedAt: i.date().optional(),
      householdId: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),
    // The template contents of a kit (not tied to any one trip).
    groupItems: i.entity({
      name: i.string(),
      qty: i.number(),
      category: i.string().optional(),
      consumable: i.boolean(),
      householdId: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),
    // A kit attached to a list, with its per-trip verification state.
    listGroups: i.entity({
      // Set when the user confirms this kit's consumables are stocked FOR THIS TRIP.
      verifiedAt: i.date().optional(),
      householdId: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),

    // --- the learning loop ----------------------------------------------------
    // Post-trip notes that make the NEXT trip's list better. Captured offline, synced later.
    reflections: i.entity({
      // 'wished_had'   — should have brought it (→ suggest next time)
      // 'didnt_need'   — brought it, never used it (→ demote next time)
      // 'forgot'       — was on the list, never packed
      // 'leave_behind' — tends to get left at the campsite (→ add to the return list)
      // 'restock'      — a consumable ran out (→ flag the kit)
      kind: i.string().indexed(),
      note: i.string().optional(),
      // Cleared once it has been acted on (folded into a list or kit).
      resolved: i.boolean().indexed(),
      householdId: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),
    // Scheduled nudges. The engine mirrors these into QStash and stamps sentAt on delivery.
    reminders: i.entity({
      kind: i.string().indexed(), // 'pre_departure' | 'reflection' | 'restock'
      scheduledFor: i.date().indexed(),
      sentAt: i.date().optional(),
      // QStash message id, so a rescheduled trip can cancel the old message.
      externalId: i.string().optional(),
      householdId: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),
  },

  links: {
    // identity ---------------------------------------------------------------
    profileUser: {
      forward: { on: 'profiles', has: 'one', label: '$user' },
      reverse: { on: '$users', has: 'one', label: 'profile' },
    },

    // tenancy ----------------------------------------------------------------
    householdMemberProfile: {
      forward: { on: 'householdMembers', has: 'one', label: 'profile' },
      reverse: { on: 'profiles', has: 'many', label: 'householdMemberships' },
    },
    householdMemberHousehold: {
      forward: { on: 'householdMembers', has: 'one', label: 'household' },
      reverse: { on: 'households', has: 'many', label: 'members' },
    },
    // Denormalized access cache read by the permission rules. Kept in sync server-side
    // whenever householdMembers change.
    profileHouseholds: {
      forward: { on: 'profiles', has: 'many', label: 'households' },
      reverse: { on: 'households', has: 'many', label: 'memberProfiles' },
    },
    personHousehold: {
      forward: { on: 'people', has: 'one', label: 'household' },
      reverse: { on: 'households', has: 'many', label: 'people' },
    },
    // A person MAY correspond to a login (Jared, Brooke) or not (Walker).
    personProfile: {
      forward: { on: 'people', has: 'one', label: 'profile' },
      reverse: { on: 'profiles', has: 'many', label: 'personas' },
    },
    invitationHousehold: {
      forward: { on: 'invitations', has: 'one', label: 'household' },
      reverse: { on: 'households', has: 'many', label: 'invitations' },
    },

    // trips ------------------------------------------------------------------
    tripHousehold: {
      forward: { on: 'trips', has: 'one', label: 'household' },
      reverse: { on: 'households', has: 'many', label: 'trips' },
    },
    // Clone lineage: which past trip this one was generated from.
    tripClonedFrom: {
      forward: { on: 'trips', has: 'one', label: 'clonedFrom' },
      reverse: { on: 'trips', has: 'many', label: 'clones' },
    },

    // lists ------------------------------------------------------------------
    listTrip: {
      forward: { on: 'lists', has: 'one', label: 'trip' },
      reverse: { on: 'trips', has: 'many', label: 'lists' },
    },
    // null owner = a shared list everyone works from.
    listOwner: {
      forward: { on: 'lists', has: 'one', label: 'owner' },
      reverse: { on: 'people', has: 'many', label: 'ownedLists' },
    },

    // items ------------------------------------------------------------------
    itemList: {
      forward: { on: 'items', has: 'one', label: 'list' },
      reverse: { on: 'lists', has: 'many', label: 'items' },
    },
    // Which people this item covers. Empty = the whole household.
    itemAssignees: {
      forward: { on: 'items', has: 'many', label: 'assignees' },
      reverse: { on: 'people', has: 'many', label: 'assignedItems' },
    },
    // Set when the item came from a kit, so kit changes can be traced.
    itemGroup: {
      forward: { on: 'items', has: 'one', label: 'group' },
      reverse: { on: 'itemGroups', has: 'many', label: 'items' },
    },

    // kits -------------------------------------------------------------------
    itemGroupHousehold: {
      forward: { on: 'itemGroups', has: 'one', label: 'household' },
      reverse: { on: 'households', has: 'many', label: 'itemGroups' },
    },
    groupItemGroup: {
      forward: { on: 'groupItems', has: 'one', label: 'group' },
      reverse: { on: 'itemGroups', has: 'many', label: 'contents' },
    },
    listGroupList: {
      forward: { on: 'listGroups', has: 'one', label: 'list' },
      reverse: { on: 'lists', has: 'many', label: 'listGroups' },
    },
    listGroupGroup: {
      forward: { on: 'listGroups', has: 'one', label: 'group' },
      reverse: { on: 'itemGroups', has: 'many', label: 'listGroups' },
    },

    // the learning loop --------------------------------------------------------
    reflectionTrip: {
      forward: { on: 'reflections', has: 'one', label: 'trip' },
      reverse: { on: 'trips', has: 'many', label: 'reflections' },
    },
    // Optional: the specific item this reflection is about (absent for "wished I had X").
    reflectionItem: {
      forward: { on: 'reflections', has: 'one', label: 'item' },
      reverse: { on: 'items', has: 'many', label: 'reflections' },
    },
    reflectionPerson: {
      forward: { on: 'reflections', has: 'one', label: 'person' },
      reverse: { on: 'people', has: 'many', label: 'reflections' },
    },
    reflectionAuthor: {
      forward: { on: 'reflections', has: 'one', label: 'author' },
      reverse: { on: 'profiles', has: 'many', label: 'reflections' },
    },
    reflectionGroup: {
      forward: { on: 'reflections', has: 'one', label: 'group' },
      reverse: { on: 'itemGroups', has: 'many', label: 'reflections' },
    },

    reminderTrip: {
      forward: { on: 'reminders', has: 'one', label: 'trip' },
      reverse: { on: 'trips', has: 'many', label: 'reminders' },
    },
  },
});

// Typed export (per InstantDB's convention).
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
