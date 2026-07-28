# Roadmap

Working state and what's next. `PRODUCT.md` says what this is for and `DESIGN.md` says how it
should look; this file says where we are in building it.

Branch: `rebuild/expo-instantdb-clerk` (despite the name, Clerk is out — InstantDB guest auth).

---

## Where we are

**Track A is done. The loop closes.** Camp List describes a trip, suggests a list from what this
household actually packed on trips like it, learns what happened afterwards, and leads the next
trip with what got forgotten. Every part of that runs offline, single-user, today.

Done and on the branch:

- Trip screen — lists per person, kits that gate on consumables, three-state packing
- Trip metadata — five open axes (type, travel, lodging, activities, conditions), all
  multi-select, seeded and rule-driven. See `mobile/lib/seeds.ts`
- **Trip matcher** — scores past trips against the current one. `mobile/lib/similarity.ts`
- **Item suggestions from history**, falling back to seeds. `itemHistory.ts` + `suggest.ts`
- **Chip suggestions from history** — `tagsLikeThisTrip` in `tagHistory.ts`
- **Reflections** — the post-trip disambiguation, and the verdicts it feeds back
- Creation stepper + flat edit form, sharing one field registry so they can't drift
- 334 tests, mutation-verified on every rule that matters

### The shape of the engine

Four modules, split by what has other callers:

| module | answers |
|---|---|
| `similarity.ts` | how alike two trips are |
| `itemHistory.ts` | what the matching ones say to pack |
| `reflections.ts` | what somebody said afterwards |
| `suggest.ts` | what to actually show, merging all of it with the seeds |

The ordering it settles on, highest first: **what someone asked for** (a `wished_had` note — the
only input from a person rather than an inference), then **gear for a tag no past trip carried**
(the new part of the trip is the forgettable part), then **history**, then **seeds**, then
**anything a note demoted**.

---

## Two tracks

These have been getting conflated in conversation. They are not the same size and not the same
urgency.

**Track A — make the loop smarter.** Single-user, dogfoodable today, and the actual product
thesis: a list that gets better every trip. **Done.**

**Track B — make it multi-user.** Accounts, invitations, letting someone else own their own
list. Now that Track A gives a second person a reason to open the app, this is what's left.

---

## Next, in order

### 1. Auth — Track B's first step, but also a live single-user bug

**This is already biting.** The web build creates a separate guest household from the native
app, so the same person on a phone browser cannot see their own trips. Same root cause as the
onboarding hole: with no email there is no way to recover or rejoin an identity.

Email magic-code sign-in, with the guest upgrade path. InstantDB keeps the same user id when a
guest signs in, so this is additive rather than a migration — see `mobile/lib/useSession.ts`.

Closes three things at once: the split-household bug, the onboarding fork, and the documented
membership hole in `instant.perms.ts`.

Sequencing note: this is a *when do you want it* call rather than a dependency one. Nothing in
Track A needed it, and Track A is finished — so this is now simply next.

### 2. Invitations, then delegation — Track B

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

- **"Start from a past trip"** — the matcher makes this cheap now: rank, offer the top one, copy
  its list. Partly obsolete on arrival, since suggestions already draw from the same trips, so
  it's worth building only if picking a whole list at once still feels missing in practice.
- **Kits from history** — `itemHistory.ts` skips kit rows on purpose, because copying one as a
  plain item produces an empty "Camp kitchen" that reads as handled and isn't. Suggesting the
  actual kit means instantiating its contents, which is a real feature rather than a filter tweak.
- **Sentence-style trip header** — option C from the layouts doc, approved and never built. The
  trip screen header reads as prose ("A camping trip to Mirror Lake, Sep 4–7…") with unfilled
  parts as dotted placeholders.
- **iOS dev build** — never made one. The StateBox animation timing and the haptics have never
  been verified on real hardware, and iOS is the first-class target.
- **Departure nudge** — catches the biggest real failure (distracted mid-pack) at a known
  moment. `departAt` and `pushToken` are both live; needs a server to send.
- **Return list** — `lists.kind = 'return'` exists. It must be EARNED from `leave_behind`
  reflections, never a copy of the outbound list: breaking camp is the worst moment this app
  will be used in. The reflection screen doesn't ask about `leave_behind` or `restock` yet — both
  are in the schema, and both should be earned by a real need rather than added as more questions
  on a screen whose whole discipline is asking only two.
- **LLM cold start** — strongest exactly where history is weakest (a novel trip, a first trip).
  Needs a server to hold the key, so it's the first thing here that isn't client-side.

## Known live issues

- **Split households across platforms** (see Auth above).
- **Membership hole** — a client that knows a household UUID can add itself. Documented in
  `instant.perms.ts`; the fix is gated on invitations.
- **Deprecated schema fields** — `tripType`, `travel`, `lodging`, `setting` are all superseded by
  their plural forms and still read as fallbacks. `axesOf()` in `mobile/lib/tripMeta.ts` is the
  single place that collapses them, so it's one function to delete when the attrs are dropped.
