/**
 * Creates the first household for a user, as the admin SDK.
 *
 * The CEL rules make profile + membership writes server-only on purpose (a client must not
 * be able to link itself into someone else's household), which leaves a chicken-and-egg on
 * the very first sign-in. The engine will own this in M3; until then, run it by hand.
 *
 * The user must have signed in at least once so Instant has a $user for their email.
 *
 * Usage:
 *   TOKEN=$(cd ~/code/crossline && infisical-agent secrets get INSTANTDB_CLI_TOKEN --env=dev --plain)
 *   INSTANT_APP_ID=... INSTANTDB_ADMIN_TOKEN=... \
 *     npx tsx scripts/bootstrap-household.ts you@example.com "The Gibsons" Jared Brooke Walker
 */
import { init, id } from '@instantdb/admin';
import schema from '../instant.schema';

const APP_ID = process.env.INSTANT_APP_ID;
const ADMIN_TOKEN = process.env.INSTANTDB_ADMIN_TOKEN;

if (!APP_ID || !ADMIN_TOKEN) {
  console.error('Set INSTANT_APP_ID and INSTANTDB_ADMIN_TOKEN.');
  process.exit(1);
}

const [email, householdName = 'My Household', ...peopleNames] = process.argv.slice(2);

if (!email) {
  console.error('Usage: bootstrap-household.ts <email> [householdName] [person...]');
  process.exit(1);
}

const db = init({ appId: APP_ID, adminToken: ADMIN_TOKEN, schema });

async function main() {
  // 1. The $user must already exist — it's created by Instant on first sign-in.
  const user = await db.auth.getUser({ email });
  if (!user) {
    console.error(`No Instant user for ${email}. Sign in through the app once, then re-run.`);
    process.exit(1);
  }

  // 2. Don't double-bootstrap.
  const existing = await db.query({
    profiles: { $: { where: { '$user.id': user.id } }, households: {} },
  });
  const alreadyIn = existing.profiles?.[0]?.households?.length ?? 0;
  if (alreadyIn > 0) {
    console.log(`${email} is already in ${alreadyIn} household(s). Nothing to do.`);
    return;
  }

  const now = new Date();
  const profileId = existing.profiles?.[0]?.id ?? id();
  const householdId = id();
  const membershipId = id();
  const userId = user.id;

  // 3. Profile + household + membership, plus the denormalized access-cache link
  //    (profiles.households) that every CEL rule reads.
  const coreTxs = [
    db.tx.profiles[profileId]
      .update({ name: peopleNames[0] ?? email.split('@')[0], createdAt: now })
      .link({ $user: userId })
      .link({ households: householdId }),

    db.tx.households[householdId].update({ name: householdName, createdAt: now }),

    db.tx.householdMembers[membershipId]
      .update({ role: 'owner', joinedAt: now })
      .link({ profile: profileId, household: householdId }),
  ];

  // 4. One `people` row per family member. The first is linked to the signing-in profile;
  //    the rest (kids) intentionally have no login.
  const peopleTxs = peopleNames.map((name, index) => {
    const tx = db.tx.people[id()]
      .update({ name, householdId, createdAt: now })
      .link({ household: householdId });
    return index === 0 ? tx.link({ profile: profileId }) : tx;
  });

  await db.transact([...coreTxs, ...peopleTxs]);

  console.log(`Bootstrapped "${householdName}" (${householdId}) for ${email}`);
  if (peopleNames.length) console.log(`  people: ${peopleNames.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
