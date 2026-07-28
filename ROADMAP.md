# Roadmap

Working state and what's next. `PRODUCT.md` says what this is for and `DESIGN.md` says how it
should look; this file says where we are in building it.

Branch: `rebuild/expo-instantdb-clerk` (despite the name, Clerk is out — InstantDB guest auth).

---

## Where we are

The **input side is finished**. Camp List can describe a trip precisely, and as of the item-seed
work it produces a starting packing list from that description. What it cannot yet do is learn:
nothing reads a past trip back.

Done and on the branch:

- Trip screen — lists per person, kits that gate on consumables, three-state packing
- Trip metadata — five open axes (type, travel, lodging, activities, conditions), all
  multi-select, seeded and rule-driven. See `mobile/lib/seeds.ts`
- Item suggestions from those tags, reviewed at creation and offered in the add sheet. See
  `mobile/lib/itemSeeds.ts`
- Creation stepper + flat edit form, sharing one field registry so they can't drift
- 249 tests, mutation-verified on every rule that matters

---

## Two tracks

These have been getting conflated in conversation. They are not the same size and not the same
urgency.

**Track A — make the loop smarter.** Single-user, dogfoodable today, and the actual product
thesis: a list that gets better every trip.

**Track B — make it multi-user.** Accounts, invitations, letting someone else own their own
list. Bigger, later, and mostly meaningless until Track A gives a second person a reason to
open the app.

---

## Next, in order

### 1. Similarity matcher — Track A

Score past trips against the current one on the axes already captured, and let the highest
scorers drive suggestions. **Seeds are the cold start; history should outrank them the moment it
exists.** Everything I hand-wrote in `itemSeeds.ts` is a placeholder for what this produces.

First caller is "start from a past trip." Second caller is the chip seeds themselves — the
type-keyed lookup in `seeds.ts` is explicitly interim and should become a caller of this rather
than keeping its own hand-curated defaults.

No prerequisites. Highest product value of anything on this list.

### 2. Reflections — Track A

Schema is done and pushed (`reflections`, including `name` for the cases with no item to link
to). The UI is not built.

Worth doing early because of a limit that shapes everything downstream: **history can only ever
suggest what you've packed before. It cannot learn from what you forgot.** The post-trip note is
the only input that can add something genuinely new, which makes it higher-leverage than the
engine it feeds.

Design decided, not built: a reflection is a **disambiguation**, not a journal. An item on the
list that never got packed means four different things — forgot / skipped / didn't fit /
mistracked — and two of them point the opposite way from the other two. Ask, one tap per item;
guessing is worse than not asking. See the `reflections` comment in `instant.schema.ts`.

### 3. Auth — Track B's first step, but also a live single-user bug

**This is already biting.** The web build creates a separate guest household from the native
app, so the same person on a phone browser cannot see their own trips. Same root cause as the
onboarding hole: with no email there is no way to recover or rejoin an identity.

Email magic-code sign-in, with the guest upgrade path. InstantDB keeps the same user id when a
guest signs in, so this is additive rather than a migration — see `mobile/lib/useSession.ts`.

Closes three things at once: the split-household bug, the onboarding fork, and the documented
membership hole in `instant.perms.ts`.

Sequencing note: this is a *when do you want it* call rather than a dependency one. Nothing in
Track A needs it.

### 4. Invitations, then delegation — Track B

Only after auth, and only when a second person has a reason to show up.

- `invitations` exists but has **no link to a person** — that's the one schema gap. Inviting
  someone should be able to say "this is Brooke", the person record that already exists.
- The gate for whether delegation is even offered is already in the schema: **`people.profile`**.
  A person with a linked profile is a real account; without one they're a local record only the
  owner can manage, and offering to hand them their list would be offering something impossible.
- Then: skip a person's section at trip creation ("Brooke will do her own"), and give her a
  distilled review of just her list when she opens the trip.

**Roles are deliberately deferred.** The live perms already say *anyone in the household can
edit anything*, which is the agreed starting point, so v1 needs zero permissions work. Roles
would be a later pass that restricts — no rework created by skipping them now.

---

## Smaller, unscheduled

- **Sentence-style trip header** — option C from the layouts doc, approved and never built. The
  trip screen header reads as prose ("A camping trip to Mirror Lake, Sep 4–7…") with unfilled
  parts as dotted placeholders.
- **iOS dev build** — never made one. The StateBox animation timing and the haptics have never
  been verified on real hardware, and iOS is the first-class target.
- **Departure nudge** — catches the biggest real failure (distracted mid-pack) at a known
  moment. `departAt` and `pushToken` are both live; needs a server to send.
- **Return list** — `lists.kind = 'return'` exists. It must be EARNED from `leave_behind`
  reflections, never a copy of the outbound list: breaking camp is the worst moment this app
  will be used in.
- **LLM cold start** — strongest exactly where history is weakest (a novel trip, a first trip).
  Needs a server to hold the key, so it's the first thing here that isn't client-side.

## Known live issues

- **Split households across platforms** (see Auth above).
- **Membership hole** — a client that knows a household UUID can add itself. Documented in
  `instant.perms.ts`; the fix is gated on invitations.
- **Deprecated schema fields** — `tripType`, `travel`, `lodging`, `setting` are all superseded by
  their plural forms and still read as fallbacks. `axesOf()` in `mobile/lib/tripMeta.ts` is the
  single place that collapses them, so it's one function to delete when the attrs are dropped.
