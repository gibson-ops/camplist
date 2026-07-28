# Camp List

Trip-scoped packing lists that get smarter every trip. iOS first, then Android, then web.

The core bet: most packing apps make you build a list from scratch every time. Camp List
builds each trip from the last one, learns from what you actually used, and nags you about
the things you always forget.

## Status

**M0 — foundation.** The app scaffold, data model, and auth bridge are in place. Not yet
usable as a packing app; see the roadmap.

## Stack

| Layer         | Choice                                | Why                                                                          |
| ------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| App           | Expo / React Native (SDK 57)          | One codebase for iOS → Android → web, shipped as a real native binary        |
| Data + sync   | InstantDB (`@instantdb/react-native`) | Offline-first for free: local query resolution, buffered writes, auto-resync |
| Auth          | Clerk (`@clerk/expo` v4)              | Email-code sign-in; bridged into Instant via `signInWithIdToken`             |
| Engine _(M3)_ | Hono on Railway                       | LLM list generation + QStash-scheduled push notifications                    |

Native Swift was considered and rejected: InstantDB ships no official Swift SDK, so a native
app would mean owning an unofficial sync layer and re-solving it again for Android and web.

## Layout

```
PRODUCT.md            who it's for, the voice, the anti-references, design principles
DESIGN.md             the visual system: tokens, rules, component specs
instant.schema.ts     data model — the shared source of truth (mobile, later web + engine)
instant.perms.ts      CEL permission rules
mobile/               the Expo app
  app/                expo-router routes: (auth) public, (app) protected
  app/(app)/design    living gallery of every component, in both schemes
  design/             the design system in code: tokens, theme, components
  lib/db.ts           InstantDB client
  lib/useInstantClerkAuth.ts   the Clerk → Instant session bridge
docs/setup.md         account setup, env vars, how to run it
docs/reference/       ported logic from earlier iterations
```

## Design

Screens import from `mobile/design`, never from a local StyleSheet that invents its own
colors or sizes. `DESIGN.md` is the spec; the code is its implementation.

The system is called **The Trailhead Sign**: flat surfaces separated by tone, one signal
color used sparingly, squared geometry, and type hierarchy carried by weight rather than
color. It refuses both of its category's reflexes, the woodsy forest-green outdoor brand and
the tactical black-and-safety-orange GPS app, in favor of warm stone and survey yellow.

Three rules do the most work:

- **Fill-Only.** Survey Yellow measures 1.79:1 on the light background, so it is forbidden as
  text, icon stroke, or hairline there. Fill with dark text on top (9.0:1) or nothing.
- **Colorblind Floor.** No state is ever color alone. Packed is yellow _and_ a check; loaded
  is green _and_ a box glyph. Strip the color and the screen still reads.
- **Flat Field.** If a surface can't be dragged or dismissed, it gets no shadow. Only the
  bottom sheet floats.

Run the app and open **Design system** from the home screen to see all of it live.

## Data model in one breath

`household → people + trips → lists → items`, plus reusable kits and post-trip reflections.

Two fields carry most of the product logic:

- **`items.assignees`** — which people an item covers (empty = the whole household).
- **`items.sharing`** — `'each'` (everyone brings their own) vs `'one'` (one covers them all).

Together they express shared gear, per-person gear, "we each bring our own", and "one of
these for both of us" — the four cases that make packing for a family annoying.

`people` are deliberately not `profiles`: Walker gets his own packing list without a login.

## Roadmap

| Milestone             | Delivers                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| **M0** foundation     | Scaffold, schema, Clerk↔Instant bridge ← _here_                             |
| **M1** core packing   | Trips, lists, items, people, packed/loaded states. Replaces the `pack` YAML |
| **M2** reuse & smarts | Kits + restock checks, clone-from-past-trip, suggestions, LLM generation    |
| **M3** notifications  | Pre-departure, post-trip reflection, restock nudges                         |
| **M4** multi-platform | Android, web, App Store + Play                                              |

## History

This is the fourth iteration. Earlier ones informed the model and are kept for reference:

- **v1** (React + IndexedDB PWA) — never shipped. Its tag/co-occurrence suggestion engine is
  preserved at `docs/reference/v1-suggestion-engine.ts` and gets ported in M2. Full source is
  in git history at `main` (`ee82fff`).
- **alpha** (Go + htmx over the YAML) — `~/code/gibson-ops/camplist-alpha`.
- **`pack`** (YAML + CLI, in daily use) — `~/packing`, `~/bin/pack`. M1 replaces it.

## Getting started

See [docs/setup.md](docs/setup.md). Clerk setup requires dashboard access.
