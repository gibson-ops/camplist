# Camp List — mobile

Expo / React Native app. `DESIGN.md` and `PRODUCT.md` at the repo root are the design contract;
`instant.schema.ts` is the data contract; `ROADMAP.md` is where the work is up to and what's
next. **Read ROADMAP.md first** — it says which of two tracks a piece of work belongs to, and
several things that look like next steps are deliberately parked behind others.

## Before you say it works

```bash
npm run check     # from the repo root: typecheck + tests
```

Run it after every change. A screen that renders is not evidence that the rules underneath it
still hold — the kit gate, the packing state cycle, and the collapse-override rules are all
invisible from a screenshot.

For anything that changes what the user sees, also drive it on a device. See
`docs/setup.md` for the emulator and `agent-device` loop.

## Testing notes

- `jest-expo/android` preset. Suites live next to what they test (`lib/trips.test.ts`).
- `test/render.tsx` wraps components in the providers a real screen has. **Read the comment at
  the top of that file before writing a component test** — RNTL v14 made both `render` and
  `fireEvent` async, and a missing `await` on `fireEvent` silently breaks every *later* test in
  the file rather than the one you wrote.
- Test the rules, not the implementation. The suites worth having are the ones that fail when
  someone "simplifies" a rule away: only consumables gate a kit, kit contents link to their
  parent and never to a list, a collapse override is deleted rather than pinned when it returns
  to the default.
- `lib/db` is mocked in `lib/trips.test.ts` — it throws at import without an app id, and would
  otherwise open a real socket.

## Layering

- `lib/db.ts` is the ONLY module that imports an InstantDB SDK. Metro swaps in `db.web.ts` for
  web, which is what keeps first-class web support a one-file change. Never import
  `@instantdb/react-native` anywhere else.
- Screens import from `design/`, never from a screen-local StyleSheet that invents its own
  colors or sizes.
- Shared components live in `components/`, NOT under `app/` — expo-router turns every file in
  `app/` into a route.
