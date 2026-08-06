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

- Trip screen — lists per person, three-state packing, and kits whose contents are two-state:
  anything that needs no verifying is good by default, so what you look for is all green
- Trip metadata — five open axes (type, travel, lodging, activities, conditions), all
  multi-select, seeded and rule-driven. See `mobile/lib/seeds.ts`
- **Trip matcher** — scores past trips against the current one. `mobile/lib/similarity.ts`
- **Item suggestions from history**, falling back to seeds. `itemHistory.ts` + `suggest.ts`
- **Chip suggestions from history** — `tagsLikeThisTrip` in `tagHistory.ts`
- **Reflections** — the post-trip disambiguation, and the verdicts it feeds back
- Creation stepper + flat edit form, sharing one field registry so they can't drift
- **Auth** — email magic-code sign-in, guest upgrade keeping the same user id, and the merge
  screen for a device that already had a guest household. `mobile/lib/useSession.ts`
- **Onboarding** — first run, `onboardedAt` so a returning device skips it, profile + avatar
- Trip grouping on the home screen — on-this-trip / up next / later / past. `lib/tripGroups.ts`
- **Check reasons** — a kit's contents say WHAT needs checking (present / stocked / charged /
  clean / serviced / in date / replaced), asked as a question and stated once answered.
  `lib/checkReasons.ts`
- **Duplicate protection and autocomplete** — the same name can't go on twice, and typing offers
  what the household already calls things, drawn from every trip rather than the matching ones.
  `lib/itemKey.ts` + `lib/itemNames.ts` + `lib/fuzzy.ts`
- **The replay** — `/loop` recomputes what the app WOULD have suggested for every past trip,
  using only what it knew before that trip existed. Not linked from anywhere; it is an instrument,
  not a feature. `lib/loopMetrics.ts` + `docs/learning-loop-plan.md`
- 542 tests, mutation-verified on every rule that matters

### The shape of the engine

Four modules, split by what has other callers:

| module           | answers                                                 |
| ---------------- | ------------------------------------------------------- |
| `similarity.ts`  | how alike two trips are                                 |
| `itemHistory.ts` | what the matching ones say to pack                      |
| `reflections.ts` | what somebody said afterwards                           |
| `suggest.ts`     | what to actually show, merging all of it with the seeds |

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
list. Accounts are done; invitations are what's left.

---

## Next, in order

### 1. Invitations, then delegation — Track B

Auth landed (see "Where we are"), which was Track B's first step and also the fix for the
split-household bug. Everything below was gated on it and no longer is.

Only when a second person has a reason to show up.

- `invitations` exists but has **no link to a person** — that's the one schema gap. Inviting
  someone should be able to say "this is Brooke", the person record that already exists.
- The gate for whether delegation is even offered is already in the schema: **`people.profile`**.
  A person with a linked profile is a real account; without one they're a local record only the
  owner can manage, and offering to hand them their list would be offering something impossible.
- Then: skip a person's section at trip creation ("Brooke will do her own"), and give her a
  distilled review of just her list when she opens the trip.

**Roles are deliberately deferred.** The live perms already say _anyone in the household can
edit anything_, which is the agreed starting point, so v1 needs zero permissions work. Roles
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

- **Check reasons could feed the learning loop — the part that is NOT built.** The vocabulary and
  the two-state kit shipped (see "Where we are"); what has not is the loop noticing.

  A `wished_had` on a dead lantern is a different lesson from a `forgot`, and the reason is what
  distinguishes them — so a reason that keeps coming back answered late is evidence about the item,
  not just about one trip. Two concrete follow-ons: history-derived suggestions do not carry the
  reason yet, so a re-suggested lantern comes back unspecified; and an item repeatedly found missing
  at pack time is self-evidently a `present` item, which the packing record could notice rather than
  asking.

  Worth naming what this replaced, because the shape was not obvious: `consumable` was never really
  "can run out", it was "needs a look", and its inverse was already "always in the kit". So the
  model Jared described needed no migration and no new flag — only for the reason to be a word, and
  for the contents that need no look to stop pretending they are a checklist.

- **Checked items sort themselves down, the way Apple Notes does.** Jared's request, with the
  hazard already identified: "you don't want to check something off and have it jump off the
  screen, which is very likely to happen." On a long list, the row you just touched is the row you
  lose.

  He suggested following it with a quick smooth scroll, and that Notes may simply let it jump
  without it feeling bad. Worth MEASURING before choosing — a screen recording of Notes settled the
  sheet motion when reasoning about it had failed twice, and this is the same kind of question.

  Two things make this harder here than in Notes, and both need answering first:

  - **Items have three states, not two.** unpacked → packed → loaded. "Checked sinks" is obvious
    for a checkbox and ambiguous for a cycle: does `loaded` sit below `packed`, or do they share a
    band? A kit's CONTENTS are genuinely two-state, so they sort cleanly — which makes them the
    place to try this first.
  - **A trip has several lists.** Sorting is per list, never across them, or a packed item leaves
    Brooke's section and appears in Walker's.

  The cheapest version dodges the whole problem: sort on ARRIVAL rather than on tap. The list is
  ordered when you open the screen and nothing moves while you work, which is what a paper list
  does, and it costs the satisfying settle that makes Notes feel alive. Worth trying against the
  animated version rather than assuming the fancier one wins — packing happens one-handed, in the
  dark, often while holding something.

  No data change either way: `sortOrder` exists and `byOrder` already sorts client-side, so this is
  a comparator plus an animation decision. Whatever lands must honor `prefers-reduced-motion`, and
  must not move a row out from under a thumb mid-tap.

- **Optional kit members — offered when you add, not added for you.** Jared: "some items marked as
  optional so they don't automatically get added to the kit, but are suggested when adding items to
  a kit. That way I could remember to add something to a kit that sometimes is needed or wanted."

  This is a property of the KIT TEMPLATE rather than of an item on a trip, which is what makes it
  cheap: `itemGroups` and `groupItems` already model a reusable kit and its roster, so an optional
  member is a flag on the membership. Instantiating a kit skips them; the "Add to <kit>" sheet
  offers them first, above the history suggestions, because a thing you deliberately marked optional
  is a stronger signal than a thing you happened to pack once.

  Worth keeping distinct from `oneOff` and from the check reasons. `oneOff` is "never suggest this
  again", a check reason is "this is in the box but might not be usable", and optional is "this
  belongs to the kit but only sometimes comes" — three different answers to three different
  questions, and collapsing any two of them loses one.

  The interesting follow-on is that it can be LEARNED rather than asked: an optional member accepted
  on most trips wants promoting to a standard one, and a standard member removed most trips wants
  demoting. Same shape as the co-occurrence entry below, and the same caution applies — only offer
  the change when the record is one-sided enough to be a habit rather than a run.

- **The context axes are the underweighted ones** — three separate observations from Jared land on
  the same finding, so they belong together. He wants the app to learn that spring bar tents are
  church Young Men gear, that the truck carries tools and fluids the commuter doesn't, and that
  camping with Brooke means the double sleeping bag. All three are _who and what you're travelling
  with_, and the current weights read:

  ```
  tripTypes: 3   lodgings: 3   travelModes: 2
  activities: 2  conditions: 2  attendees: 1  destination: 1  season: 1
  ```

  `attendees` is 1, tied with season, when who is along is probably the strongest predictor of gear
  a household owns. And vehicle isn't modeled at all — truck and commuter are both `Driving`.

  Worth noting what does NOT need building: item-level tags. Suggestions already flow from
  trip↔trip similarity, so an item packed only on YM trips is self-describing in the history. The
  missing ingredient is only ever a trip-level marker that makes those trips distinguishable, which
  is why per-item chips would be work without a payoff.

  Three steps, cheapest first. Raise `attendees` and see (one line, one test). Add a `vehicle`
  household entity with trips referencing it — vehicles are household possessions like people, so
  the symmetry is already there. Resist a generic "church youth" value inside `tripTypes`: a YM trip
  IS camping, and overloading the axis muddies what it means. A dedicated "who it's for" axis is the
  honest shape, and it's the one place a new axis earns itself.

  Exclusion still comes from dismissal, not similarity: even at weight 3 a YM camping trip clears
  `MATCH_FLOOR`, so its gear ranks lower rather than vanishing. One dismissal does the fine work,
  and verdicts are already scoped by trip shape so it won't unlearn it for YM trips.

- **Shared-by-some, not shared-by-all** — the sharing model has exactly two modes and needs a third.
  `sharing: 'one' | 'each'` says a cooler is one for the trip and a sleeping bag is one per person.
  A DOUBLE sleeping bag is neither: Jared and Brooke share it, Walker doesn't touch it. On the shared
  list it implies everyone benefits; on a person's list the other person's list wants a duplicate.

  The real-world concept underneath is sleeping arrangements — who shares a tent, a mattress, a bag.
  That's Camp List-native rather than generic: it decides a whole class of gear at once, and it's
  knowable at trip time. Model it as pairs/groups within a trip's attendees and the double bag,
  the double mattress and the two-person tent all fall out of one answer instead of three
  item-by-item corrections.

- **Learn from what travels together** — Jared: "if I pack the Starlink kit, I'll usually want the
  portable power source with it." This is a different KIND of signal from everything else in the
  matcher and worth keeping distinct. Trip similarity answers "what do trips like this one need?".
  Co-occurrence answers "given what is already on this list, what is missing?" — and only the second
  one can react to what you just did.

  The code shape falls out nicely. `onList` is currently subtractive only:

  ```ts
  const excluded = new Set([...onList, ...dismissed].map(slugify));
  ```

  Co-occurrence makes the same input additive — the list you have becomes the query for what tends
  to accompany it, so suggestions change as you pack instead of being computed once per trip.

  Two cautions. It needs more history than trip similarity does: similarity is useful from the second
  trip, whereas a pair needs enough trips to tell a habit from a coincidence, so it wants a minimum
  support and should stay silent below it. And the pairs it finds are only worth surfacing when they
  are NOT already expressible as a kit — a lantern and its spare batteries, rather than two things
  that live in the same box.

  The best version closes a loop this app already likes closing: when a pair is near-certain over
  many trips, offer to make it structural. "You've packed the power bank with Starlink every time —
  put it in the kit?" That turns an observation into a container the user owns, the same way
  `wished_had` turns a regret into a suggestion and the return list is earned from reflections
  rather than copied.

- **To-do lists, not just things to pack** — Jared: the tasks around a trip are often as important
  as the gear, and could sit alongside the packing list with a slight divider rather than on a
  screen of their own. He also guessed they make less sense to learn from, "or maybe with a
  different algorithm". That second guess is the interesting part, and it is right.

  An item is a thing you own; a task is an action. The differences are not cosmetic:

  - **Different state machine.** An item moves unpacked → packed → loaded, which is a question of
    WHERE it is. A task is done or not. Putting both in `items` behind a boolean would immediately
    pollute the pack cycle and the kit gate, the same way three more booleans on `consumable`
    would have been wrong.
  - **Tasks have lead times; items don't.** "Fill the propane" wants a store and a day before.
    "Stop the mail" is a week out. "Turn off the water heater" is as you walk out the door. "Empty
    the cooler" is after you're home. Gear has no such ordering — a tent doesn't care when it went
    in the car.

  That lead time is the different algorithm. Items are learned by what trips of this shape packed;
  tasks would be learned by **when they were done relative to `departAt`** — which produces a
  schedule rather than a checklist, "arrange the dog sitter by Thursday" instead of "you'll
  probably need a dog sitter". And it gives the **departure nudge** (already on this list, with
  `departAt` and `pushToken` both live) something specific to say, which is the thing it currently
  lacks.

  Two cautions. Keep tasks bound to a trip and its departure, or this becomes a generic to-do app
  wearing Camp List's clothes — the binding is the whole reason it belongs here. And learn from
  observed completion times, never by asking: the reflection screen's discipline is two questions,
  and a third one about chores is exactly the kind of addition that ends it.

  `lists.kind` is already typed ('outbound' | 'return'), so there is a natural seam, but tasks
  probably want their own entity rather than a third kind — see the state machine point above.

- **Offline for the home screen app — a service worker is the only route, and probably the wrong
  one.** Worth writing down because the answer is counterintuitive and the question keeps coming up.

  Three things get conflated. **Installability** needs no service worker: Chromium dropped that
  requirement and iOS never had it, which is why `cl-alpha` installs today on a manifest alone.
  **Asset caching** needs no service worker either — Expo content-hashes everything under `_expo/`
  and `assets/`, so `Cache-Control: immutable` covers it, which the Caddy route now sets. **A
  network-free cold boot is the one thing left**, because launching still fetches `index.html`, and
  nothing but a service worker can answer that request offline.

  The data layer is already fine: Instant keeps a local store and queues writes, so a list stays
  usable and syncs later once the app is running. The gap is only the shell, and only when launched
  cold with no signal — which for a camping app is exactly when it happens.

  Expo's own PWA guide argues against fixing it here: service workers are "known to cause unexpected
  behavior on web", a badly scoped one leaves users unable to pull an update, and it says outright
  that for the best offline mobile experience you should ship a native app. Camp List is going to
  have one — **iOS dev build** is already on this list, iOS is the first-class target, and a native
  app gets real offline for free. So the sequencing is: treat the web build as the dogfooding
  surface, and let offline arrive with the native app rather than building a service worker that
  Expo warns about and the native build makes redundant.

  If the native build slips and offline starts costing real trips, the contained version is a
  shell-only service worker: network-first for `index.html`, cache-first for the hashed bundle,
  nothing else. Network-first is what keeps it from ever serving a stale app while online, which is
  the failure mode the warning is about.

## Open engineering threads

Distinct from the backlog above: these are loose ends rather than features.

- **`Sheet.web.tsx` exists only to work around four `@expo/ui` defects** — a missing
  `vaul/style.css` import, a hardcoded `#000` in dark mode, `85vh` instead of a keyboard-aware
  measure, and padding on an element vaul sizes without `border-box`. Fixed upstream, the fork
  deletes itself. Worth filing.
- **iOS has never been built.** The SwiftUI sheet, the StateBox timing and the haptics have all only
  been reasoned about. Everything verified so far is web plus an Android emulator, and iOS is the
  first-class target.
- **`sheet-known-good` tags the last verified sheet state.** If the sheet regresses, diff against
  that tag before theorizing — it took a dozen attempts to reach.
- **iOS viewport numbers are not internally consistent.** Three readings gave `offsetTop + vv` as
  309 more than `window.innerHeight`, equal to it, and 207 less. Viewport arithmetic in the sheet is
  a floor, not a foundation; the structural escape if it regresses badly is sheets-with-inputs
  becoming full screens on web.

## Known live issues

- **Split households across platforms — fix shipped, never verified.** Email sign-in plus the
  merge screen is the answer, but nobody has actually signed the same account in on web and native
  and confirmed one household comes back. Worth ten minutes before trusting it.
- **Membership hole** — a client that knows a household UUID can add itself. Documented in
  `instant.perms.ts`; the fix is gated on invitations.
- **Deprecated schema fields** — `tripType`, `travel`, `lodging`, `setting` are all superseded by
  their plural forms and still read as fallbacks. `axesOf()` in `mobile/lib/tripMeta.ts` is the
  single place that collapses them, so it's one function to delete when the attrs are dropped.
