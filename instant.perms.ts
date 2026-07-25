// Camp List — InstantDB permission rules (CEL).
//
// Security model:
//   • The boundary is the VERIFIED AUTH SESSION (auth.id), never client-supplied params.
//   • Household-scoped records are gated by the denormalized profile→households cache:
//       data.householdId in auth.ref('$user.profile.households.id')
//     That cache is maintained server-side whenever householdMembers change. Admin SDK
//     writes (the engine) bypass these rules entirely, which is why the engine authorizes
//     every request itself.
//   • Transparency-first WITHIN a household: it's a family. Everyone can view and edit
//     everything — list ownership (lists.owner) and item assignees are organizational
//     labels, not access controls. Do not mistake them for a security boundary.
//   • Privileged joins (householdMembers, invitations) are server-only writes so a client
//     can't add itself to someone else's household.
//   • `attrs` create is denied: clients can't invent new attribute types (schema drift).

import type { InstantRules } from '@instantdb/core';

// Every household-scoped entity shares this rule; `inHousehold` reads the access cache.
const householdScoped = {
  bind: ['inHousehold', "data.householdId in auth.ref('$user.profile.households.id')"],
  allow: {
    view: 'inHousehold',
    create: 'inHousehold',
    update: 'inHousehold',
    delete: 'inHousehold',
  },
};

const rules = {
  attrs: {
    allow: {
      create: 'false',
    },
  },

  $users: {
    allow: {
      view: 'auth.id == data.id',
      create: 'false',
      update: 'false',
      delete: 'false',
    },
  },

  // v1: authenticated users can manage files (item photos). Household-scoping the
  // upload path is a TODO before any non-family user exists.
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
      create: 'false', // created server-side on first sign-in
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

  // profile↔household join — server-only writes.
  householdMembers: {
    bind: [
      'isSelf',
      "auth.id in data.ref('profile.$user.id')",
      'isSameHousehold',
      "auth.id in data.ref('household.memberProfiles.$user.id')",
    ],
    allow: {
      view: 'isSelf || isSameHousehold',
      create: 'false',
      update: 'false',
      delete: 'false',
    },
  },

  // invites — created/accepted via the engine only.
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
  listGroups: householdScoped,
  reflections: householdScoped,

  // Reminders are scheduled by the client but only the engine may mark them sent.
  reminders: {
    bind: ['inHousehold', "data.householdId in auth.ref('$user.profile.households.id')"],
    allow: {
      view: 'inHousehold',
      create: 'inHousehold',
      update: 'inHousehold',
      delete: 'inHousehold',
    },
  },
} satisfies InstantRules;

export default rules;
