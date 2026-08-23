// Camp List — InstantDB permission rules (CEL).
//
// Security model:
//   • The boundary is the VERIFIED AUTH SESSION (auth.id), never client-supplied params.
//     A GUEST session (db.auth.signInAsGuest) is a real auth.id, so guests are governed by
//     exactly these rules. There is no anonymous/unauthenticated read path.
//   • Household-scoped records are gated by the denormalized profile→households cache:
//       data.householdId in auth.ref('$user.profile.households.id')
//   • Guest upgrade: when a guest signs in with a NEW email, Instant keeps the same user id,
//     so their data carries over untouched. When the email already belongs to someone, the
//     old identity survives as a linked guest, which is why the household check also accepts
//     `$user.linkedGuestUsers.profile.households.id`. Without that, a merged user would lose
//     sight of everything they created before signing up.
//   • Transparency-first WITHIN a household: it's a family. Everyone can view and edit
//     everything. List ownership and item assignees are organizational labels, NOT access
//     controls. Do not mistake them for a security boundary.
//
// KNOWN GAP (deliberate, revisit when sharing ships):
//   Creating your own profile/household/membership is self-service, because the whole point
//   of the login-free start is that first launch needs no server round-trip. The rules below
//   only let you create a membership for YOURSELF, so you cannot add other people to things.
//   But a client that learns another household's UUID could add itself to that household.
//   UUIDs aren't enumerable and the data is family packing lists, so this is an accepted risk
//   for now. The fix, when invites ship: require membership writes to reference a valid
//   invitation, and move them behind the engine.

import type { InstantRules } from '@instantdb/core';

// Every household-scoped entity shares this. The second clause keeps merged guests attached
// to the data they created before signing up.
const householdScoped = {
  bind: [
    'inHousehold',
    "data.householdId in auth.ref('$user.profile.households.id')",
    'inGuestHousehold',
    "data.householdId in auth.ref('$user.linkedGuestUsers.profile.households.id')",
    'canAccess',
    'inHousehold || inGuestHousehold',
  ],
  allow: {
    view: 'canAccess',
    create: 'canAccess',
    update: 'canAccess',
    delete: 'canAccess',
  },
};

const rules = {
  attrs: {
    allow: {
      create: 'false', // clients can't invent new attribute types (schema drift)
    },
  },

  $users: {
    allow: {
      view: 'auth.id == data.id',
      // Guest sign-in (db.auth.signInAsGuest) creates a $user, so this cannot be 'false' or
      // the login-free first launch fails with "Permission denied: not perms-pass?".
      // This does not let a client forge identities: Instant owns $user creation, and
      // `update`/`delete` stay closed so an existing identity can't be altered.
      create: 'true',
      update: 'false',
      delete: 'false',
    },
  },

  $files: {
    allow: {
      view: 'auth.id != null',
      create: 'auth.id != null',
      delete: 'auth.id != null',
    },
  },

  // --- identity ---------------------------------------------------------------
  profiles: {
    bind: [
      'isSelf',
      "auth.id in data.ref('$user.id')",
      'sharesHousehold',
      "auth.id in data.ref('households.memberProfiles.$user.id')",
    ],
    allow: {
      view: 'isSelf || sharesHousehold',
      // Self-service: a first-launch guest creates its own profile, linked to its own
      // $user in the same transaction. You cannot create a profile for anyone else.
      create: 'isSelf',
      update: 'isSelf',
      delete: 'false',
    },
  },

  households: {
    bind: ['isMember', "auth.id in data.ref('memberProfiles.$user.id')"],
    allow: {
      view: 'isMember',
      create: 'auth.id != null',
      update: 'isMember',
      delete: 'false', // archive instead; no client deletes
    },
  },

  // profile↔household join. Create is limited to memberships for YOURSELF.
  householdMembers: {
    bind: [
      'isSelf',
      "auth.id in data.ref('profile.$user.id')",
      'isSameHousehold',
      "auth.id in data.ref('household.memberProfiles.$user.id')",
    ],
    allow: {
      view: 'isSelf || isSameHousehold',
      create: 'isSelf',
      update: 'false',
      delete: 'isSelf', // leaving a household is allowed; removing others is not
    },
  },

  // Invites stay server-only: this is the path by which someone joins a household they
  // did not create, so it must be validated somewhere a client can't forge.
  invitations: {
    bind: ['isMember', "auth.id in data.ref('household.memberProfiles.$user.id')"],
    allow: {
      view: 'isMember',
      create: 'false',
      update: 'false',
      delete: 'false',
    },
  },

  // --- household-scoped app data ----------------------------------------------
  people: householdScoped,
  trips: householdScoped,
  lists: householdScoped,
  items: householdScoped,
  itemGroups: householdScoped,
  groupItems: householdScoped,
  reflections: householdScoped,
  reminders: householdScoped,
} satisfies InstantRules;

export default rules;
