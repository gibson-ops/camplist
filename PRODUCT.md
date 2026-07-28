# Product

## Register

product

## Users

Families who camp together, starting with a household of three: two adults who each pack for
themselves and jointly for the family, and a young child whose gear someone else is
responsible for.

**Camping inspired, not camping constrained.** The same household flies to see relatives,
drives to a wedding, and packs for a work trip, and every one of those is the same problem:
remembering what you needed last time. Camping is the center of gravity — the default, the
richest vocabulary, the voice the copy is written in — and it is deliberately the *hardest*
case, which is why it sets the design. A product built for a campsite inherits the hotel room
for free; one built for a hotel room would have to bolt camping on, and would fail at it.

So: nothing in the model may assume a tent. Trip types, activities, and conditions are all
data rather than assumptions, and a trip that is a flight to a conference has to be a
first-class citizen even on the day its vocabulary is thinner than camping's.

Their context is the thing that shapes every design decision:

- **Packing happens at home, in a hurry**, usually the night before and the morning of,
  often while doing five other things. Interruption is the norm, not the exception.
- **Using the app happens outdoors**, in direct sunlight, at dusk, in a tent, with cold or
  dirty hands, one-handed, holding something in the other. Frequently with **no signal at
  all** — offline is the default assumption, not a degraded mode.
- **The knowledge lives across trips, not within one.** What they learned last time is the
  whole value. A packing list built from scratch each trip forgets everything.

The job to be done: *leave with everything we need, come home with everything we brought,
and get a little better at it every trip.*

## Product Purpose

Camp List turns packing from a memory exercise into an accumulating asset. Each trip's list
is built from previous trips, refined by what actually got used, and improved by notes
captured while the lessons are still fresh.

Three things distinguish it from a generic checklist:

1. **It knows who each item is for**, including people who don't have logins, and whether
   everyone needs their own or one covers the group.
2. **It closes the loop after the trip.** What you wished you'd had, what you never touched,
   what got left at the campsite. That feedback shapes the next list.
3. **It works with no connection**, because the moments that matter most (loading the car,
   breaking camp, a hotel room at 5am before a flight) are exactly when there's no signal.
4. **It describes a trip well enough to match it against past ones.** How you're traveling,
   where you're sleeping, what you'll be doing. A trip with only a name can't be matched to
   anything, and the app has nothing to suggest — so the metadata is not decoration on a
   packing list, it's the query that produces one.
5. **It suggests, and never assumes.** Everything the app works out is offered next to the
   list, one tap to take and one tap to turn down. Nothing is added on the user's behalf: a
   list that arrives pre-filled with guesses stops being read, and a list that stops being read
   is how things get forgotten — the exact failure the product exists to reduce. More items is
   not better; the right items are.

Success looks like: the household stops maintaining a parallel list somewhere else, and the
"what did we forget?" conversation stops happening on the drive out.

## Brand Personality

**Prepared, unfussy, earned.**

The voice of someone who has done this trip twenty times. Quietly competent. It does not
explain what a tent is, does not congratulate you for checking a box, and does not use
enthusiasm as a substitute for usefulness. It respects that the user is capable and busy.

Tone rules:

- State things plainly. No exclamation points, no cheerleading, no mascot.
- Never celebrate routine actions. Finishing a packing list is not an achievement.
- When something goes wrong, say what happened and what to do. No apology theater.
- Labels are nouns and verbs, not slogans.

## Anti-references

All four were explicitly rejected. This is an unusually strong constraint, and the design
should be checked against every one of them:

- **Generic SaaS dashboard.** No card grids, no hero metrics, no gradient accents, no
  purple-on-white. If it could be a screenshot in a Y Combinator deck, it is wrong.
- **Cutesy / gamified checklist app.** No confetti, streaks, badges, mascots, bouncy
  animation, or progress celebrations. Packing is a chore, not a game.
- **Cluttered outdoor-retail app.** No promo banners, no product photography, no heavy
  chrome, no competing entry points. This is a tool, not a storefront.
- **Sterile enterprise form UI.** No dense gray tables, no tiny tap targets, no endless
  label-above-input stacks. Competence should not read as joylessness.

Positive references: **AllTrails / Gaia GPS** (outdoor-native, sunlight-legible,
information-dense without feeling like a spreadsheet) and **Strava** (gear-and-activity
framing, confident data display, a sense of something earned over time).

## Design Principles

1. **Legible in sunlight, usable with gloves.** The physical environment outranks aesthetic
   preference. If a choice looks better indoors but fails on a bright trailhead, it loses.
   Contrast and tap-target size are not negotiable.

2. **Offline is the default state, not an error.** Never block, warn, or scold about
   connectivity. Sync is a background fact the user should rarely think about. A pending
   write looks settled, not pending.

3. **The list earns its content.** Anything the app can infer from past trips, it should
   offer rather than make the user retype. Suggestion beats blank input every time.

4. **Respect the interruption.** Packing is done in fragments. State is always saved, nothing
   is ever lost to a backgrounded app, and returning users land where they left off.

5. **Say less.** Every label, every empty state, every confirmation gets cut until only the
   useful part remains. Silence is the default; the app speaks when it has something to add.

## Accessibility & Inclusion

- **WCAG 2.2 AA minimum** for all text and meaningful UI, with outdoor legibility treated as
  an additional constraint on top of it: primary content targets higher contrast than AA
  requires, because AA assumes indoor lighting.
- **Tap targets 44pt minimum**, larger for primary packing actions, which are performed
  one-handed and sometimes with cold or gloved fingers.
- **Dynamic Type supported.** Layouts reflow rather than truncate or clip at large text
  sizes. No fixed-height rows containing user text.
- **Respect `prefers-reduced-motion`.** All motion is functional; when reduced, transitions
  become instant without losing meaning.
- **Never encode meaning in color alone.** Packed / loaded / unpacked states carry a shape or
  label difference as well as a color difference, for color-blind users and for glare.
