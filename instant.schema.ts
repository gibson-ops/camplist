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
// How "who is this for" works, and why it is NOT a per-item badge:
//   • A LIST is owned by a person (lists.owner), so on Jared's list every item is Jared's.
//     Showing a per-item person marker there is pure noise, which is why rows don't carry one.
//   • The SHARED list holds only what belongs to nobody in particular. Anything each of you
//     brings your own of is MATERIALIZED PER PERSON — three sleeping bags are three rows on
//     three lists, not one row with a badge. That's about packing state, not tidiness: one row
//     covering three people means Jared ticking his own marks it packed while Walker's is still
//     by the door, and the row would be lying on the one screen the product exists to make
//     honest.
//   • items.sharing survives as a property of a SUGGESTION — 'one' goes to the shared list,
//     'each' is copied to every person's — and is inert once an item is stored.
//   • items.assignees survives for the narrower case ("each of the adults"), but it is a
//     refinement of a shared item, not the primary way the app answers "whose is this".

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
    // One profile per identity, including a GUEST identity — the app creates a profile on
    // first launch before any sign-in exists (see mobile/lib/useSession.ts).
    profiles: i.entity({
      name: i.string(),
      avatarUrl: i.string().optional(),
      // Expo push token, refreshed on launch; the engine reads these to send trip reminders.
      pushToken: i.string().optional(),
      /**
       * Explicit list expand/collapse OVERRIDES only: `{ [listId]: boolean }`.
       *
       * Deliberately not a full map of every list's state. The default is "my list and the
       * shared list open, everyone else's closed", and the app can't know that Walker's list
       * is actually Jared's job. Recording only the lists the user has explicitly toggled
       * means untouched lists keep following the default, and changing that default later
       * won't fight stale stored values. Lives on the profile (not device storage) so the
       * choice follows the user across devices.
       */
      listPrefs: i.json().optional(),
      /**
       * Household ids this account left behind as a guest, waiting to be merged in: `string[]`.
       *
       * Written when someone who packed trips as a guest signs in with an email that ALREADY has
       * an account. Instant keeps both identities — the account becomes theirs and the guest is
       * attached as a linked guest — so the guest's trips are still permitted but belong to a
       * household the app no longer shows. Without a note of where they went they are, as far as
       * anyone can tell, gone.
       *
       * ON THE PROFILE RATHER THAN THE DEVICE, which is the part that isn't obvious. The linked
       * guest belongs to the USER, not to the phone it was created on, so any device signed into
       * this account can finish the merge — including a replacement phone, after the original is
       * lost. Device storage would strand the data on the one machine that can no longer see it.
       *
       * Cleared entry by entry as each household is drained. See mobile/lib/merge.ts.
       */
      pendingMerge: i.json().optional(),
      /**
       * When first-run onboarding was finished, or skipped. Absent means show it.
       *
       * A flag rather than an inference ("do they have trips yet?"), because the two answers
       * differ for the person this exists to help: someone reinstalling, or opening the app on a
       * second device, is brand new as far as the device is concerned and has no trips on it. An
       * inference would make them introduce themselves again every time.
       *
       * It also makes the short-circuit automatic. A new device starts as a guest with no flag
       * and gets onboarding; the moment they sign in, their real profile arrives with the flag
       * already set and onboarding disappears — without anyone having to declare up front that
       * they're a returning user, which is the one thing a new user can't be asked to know.
       */
      onboardedAt: i.date().optional(),
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
    /**
     * A trip is also THE QUERY that drives suggestions.
     *
     * Every optional field below exists to be cross-referenced against past trips: "what did
     * we take the last time these four went car camping somewhere cold with a fishing rod".
     * That's the product. So the metadata is not decoration on a packing list — a trip with
     * only a name can't be matched to anything, and the app has nothing to suggest.
     *
     * Every axis below is OPEN — the user can add to any of them, and the app ships seeds
     * rather than a closed set (see mobile/lib/seeds.ts). What keeps that from wrecking
     * matching isn't a vocabulary, it's canonicalization: a new value adopts a spelling already
     * in play, so "cold" / "Cold nights" / "COLD NIGHTS" converge on one instead of becoming
     * three facts. Free text that ISN'T asked to match still exists — that's `notes`.
     */
    trips: i.entity({
      name: i.string(),
      // Free text, but the form suggests previous destinations so repeat trips converge on one
      // spelling instead of "Uintas" / "the Uintas" / "Uinta Mtns".
      destination: i.string().optional(),
      notes: i.string().optional(),
      // When you LEAVE HOME (not a flight time) — drives the pre-departure reminder, and is
      // the source for time-of-year. Season is DERIVED from this, never stored: a stored
      // season silently goes stale the moment a trip gets rescheduled.
      departAt: i.date().indexed().optional(),
      // When you get back — drives the post-trip reflection prompt.
      returnAt: i.date().indexed().optional(),
      /**
       * THREE MULTI-VALUE AXES, each predicting a different chunk of the list. Stored as the
       * LABELS the user sees, exactly like activities and conditions — the app ships seeds for
       * each, not a closed set.
       *
       * These were briefly closed sets of stable ids, justified as structural. Nothing branched
       * on them, and no such list is ever finished: the travel axis shipped with "Train or boat"
       * as a single option, which is what an incomplete enumeration looks like. There is no
       * complete list of ways to sleep somewhere either.
       *
       * `tripTypes` is the seed key — it decides which lodging, activities and conditions get
       * offered FIRST, and falls back to a generic set for a type nobody seeded. `travelModes`
       * is separate because flying constrains a list harder than almost anything (bag weight,
       * liquids, nothing with fuel in it) and none of that follows from where you sleep.
       *
       * Multiple values weaken a rule rather than compounding it: seeds UNION across them, but
       * a rule that DROPS something only fires when its axis holds nothing else. One leg of a
       * trip must not suppress another leg's gear.
       */
      tripTypes: i.json().optional(), // string[] — 'Camping' | 'Vacation' | ... | anything
      travelModes: i.json().optional(), // string[] — 'Driving' | 'Flying' | ... | anything
      lodgings: i.json().optional(), // string[] — 'Tent' | 'Hotel' | ... | anything
      /**
       * DEPRECATED, all four. Two generations of the same three axes:
       *
       *   setting                          camping-only, one value
       *   tripType / travel / lodging      widened past camping, still one value each
       *
       * A trip has legs. It can be camping AND visiting people, driving out and flying back,
       * a tent one night and a spare room the next — so every axis holds a LIST now. These are
       * still read as a fallback so existing trips keep their answers; drop all four in one
       * pass once nothing writes them (see mobile/lib/tripMeta.ts, LEGACY_AXIS_LABELS).
       */
      tripType: i.string().indexed().optional(),
      travel: i.string().indexed().optional(),
      lodging: i.string().indexed().optional(),
      setting: i.string().indexed().optional(),
      /**
       * The multi-value axes. Same rules as the three above.
       *
       * Labels, not ids: a slug round-trip mangles real text ("OHV" comes back "Ohv", along
       * with every place name and brand). Slugs are used only to compare, and a new tag adopts
       * the spelling already in play so a household converges on one. The lists in tripMeta.ts
       * are SEEDS — they make the first trip useful before there's history to learn from, and
       * history outranks them after that.
       */
      activities: i.json().optional(), // string[]
      conditions: i.json().optional(), // string[] — expected weather and constraints
      status: i.string().indexed(), // 'planning' | 'active' | 'archived'
      // Any trip can be reused as a starting point; templates are the explicitly curated ones.
      isTemplate: i.boolean().indexed(),
      tags: i.json().optional(), // string[] — free-form escape hatch, not part of matching
      householdId: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),
    lists: i.entity({
      name: i.string(),
      /**
       * 'outbound' = what to bring · 'return' = what to re-pack so it doesn't get left behind.
       *
       * A return list is EARNED, never a copy of the outbound one. Breaking camp is the worst
       * moment this app will ever be used in — tired, dirty, half-packed, no signal — and a
       * ninety-item re-check there is the bloat problem at its most expensive. It holds only
       * what actually gets left: things unpacked and used on site, and whatever a
       * `leave_behind` reflection has named before.
       */
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
      /**
       * Runs out and needs restocking (propane, garbage bags, soap).
       *
       * ONLY MEANINGFUL INSIDE A KIT, which is where its single consequence lives: a kit can't be
       * marked packed while its consumable children are unverified. On a top-level row there is no
       * gate to fail and ticking the item is already the check — you cannot pack zero diapers. A
       * diaper BAG you can pack while the diapers in it ran out months ago, and that gap is the
       * entire reason the flag exists. So it isn't offered, shown, or written outside a kit.
       */
      consumable: i.boolean().indexed(),

      /**
       * WHY it needs a look — 'empty' | 'charged' | 'clean' | 'serviced' | 'expired'.
       *
       * `consumable` says a kit gates on this item; this says what the gate should ask. Depletion
       * was only ever one instance of the real idea: a thing can be sitting in the box and still not
       * usable. Batteries need charging, towels need washing, a stove needs its jet cleaned, a first
       * aid kit goes out of date. All of them are "it's in there and it isn't ready", which is
       * exactly the failure a packing list should catch, and none of them are running out.
       *
       * The reason is what the check screen says out loud, which is why it's a word and not a set of
       * flags — "Lantern — charged?" is a different instruction from "Lantern — check".
       *
       * OPTIONAL, AND ABSENT MEANS 'empty'. Every item flagged before this field existed means
       * depletion, because that is all `consumable` could mean. `reasonOf` in lib/checkReasons.ts is
       * the single place that collapses the two, so nothing else needs to know the history.
       */
      checkReason: i.string().indexed().optional(),

      /**
       * Kept out of the learning loop: a thing this trip needed and no future trip will.
       *
       * A wedding gift on the way to a campsite, a permit for one river, a costume for one party.
       * Without this they are packed once and then offered forever, because history is the whole
       * basis of suggestion and history cannot tell "we needed this" from "we need this".
       *
       * Read in exactly one place — `itemsOf` in lib/itemHistory.ts, the funnel every
       * history-derived suggestion passes through — so anything built on that history later
       * inherits the opt-out rather than having to remember it.
       *
       * NOT the same as dismissing. Dismissal is the same judgement made a trip too late, after
       * the bad suggestion has already been offered; this is it made while the thing is in your
       * hand and you know.
       */
      oneOff: i.boolean().indexed().optional(),
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

    // --- the learning loop ----------------------------------------------------
    /**
     * Post-trip notes that make the NEXT trip's list better. Captured offline, synced later.
     *
     * A reflection is a DISAMBIGUATION, not a journal entry. The app finishes every trip
     * holding signals it can't interpret — above all, items that were on the list and never
     * got packed. That single fact means four different things, and two of them point the
     * opposite way from the other two:
     *
     *   forgot    → suggest it HARDER next time
     *   skipped   → decided against it; demote for trips shaped like this one
     *   didnt_fit → wasn't relevant; demote for this trip TYPE
     *   mistracked→ it went in the car, nobody ticked it. Learn nothing.
     *
     * Guessing between them is worse than not asking, which is why the reflection prompt is a
     * tap per item rather than a blank box. Anything the app can already answer for itself
     * must not be asked.
     *
     * Scope matters as much as the answer: "didn't need camp chairs" while BACKPACKING must
     * not take chairs off a car-camping list. The trip link carries the shape, so a demotion
     * can always be scoped to trips like the one it came from.
     */
    reflections: i.entity({
      /**
       * 'wished_had'   — should have brought it (→ suggest next time). The ONLY input that can
       *                  add something never packed before; history alone can't produce it.
       * 'didnt_need'   — brought it, never used it (→ demote for this trip shape)
       * 'forgot'       — was on the list, never packed, and should have been
       * 'skipped'      — was on the list, deliberately left home (→ demote, do NOT flag)
       * 'didnt_fit'    — was on the list and irrelevant to this kind of trip
       * 'mistracked'   — was packed; the checkbox is what failed. Carries no learning signal.
       * 'dismissed'    — a suggestion turned down before the trip. Recorded because otherwise
       *                  "offered and ignored" is indistinguishable from "never offered", and
       *                  a suggestion nobody ever takes has to be able to stop appearing.
       * 'leave_behind' — tends to get left at the campsite (→ earns a place on the return list)
       * 'restock'      — a consumable ran out (→ flag the kit)
       */
      kind: i.string().indexed(),
      /**
       * What it's ABOUT, when there's no item to link to.
       *
       * `wished_had` and `dismissed` are the cases: you can't link to the sleeping pad you
       * didn't bring. Without this the only record is free-text `note`, which cannot be matched
       * — "2nd lantern" / "another lantern" / "spare lantern" is one fact typed three ways, and
       * three ways is the same as zero. Stored and canonicalized exactly like a trip tag: the
       * label the user sees, compared by slug, adopting a spelling already in play.
       */
      name: i.string().optional(),
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
    /**
     * Who is actually GOING. Deliberately not inferred from "who has a list on this trip",
     * because those are two different facts and conflating them breaks both directions:
     * Walker can come without owning a list, and a list can outlive someone dropping out.
     *
     * This is also the cleanest signal suggestions have — "trips with roughly these people"
     * matches far better than "trips that happen to have a list named Brooke".
     */
    tripAttendees: {
      forward: { on: 'trips', has: 'many', label: 'attendees' },
      reverse: { on: 'people', has: 'many', label: 'trips' },
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
    /**
     * A kit ON a list is just an item whose `group` is set — it packs and loads like anything
     * else, and its contents hang off it as child items. That's why there's no separate
     * list-group join entity: "the kitchen box is another item on the list".
     */
    itemGroup: {
      forward: { on: 'items', has: 'one', label: 'group' },
      reverse: { on: 'itemGroups', has: 'many', label: 'items' },
    },
    /**
     * Kit contents for THIS trip. Instantiated from the kit's groupItems when it's added to a
     * list, then owned by the trip — so a consumable can be marked low on one trip without
     * touching the template, and a one-off can be dropped in the box for a single trip.
     *
     * A parent can only be marked packed once its unverified CONSUMABLE children are handled;
     * the skillet that never leaves the box doesn't need ticking every time.
     */
    itemParent: {
      forward: { on: 'items', has: 'one', label: 'parent' },
      reverse: { on: 'items', has: 'many', label: 'children' },
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
