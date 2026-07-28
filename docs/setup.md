# Camp List — setup

One account backs this app: **InstantDB** (data, sync, auth, permissions). There is no
separate auth provider, and no dashboard step before you can run it.

## What already exists

| Thing             | Value                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| InstantDB dev app | `camplist-dev` — appId `6eaf2c74-0277-43e6-a105-c642e76778a8`                                                         |
| Instant account   | `jared@gibsonops.com` (Gibson Ops-wide; CLI token is in the **crossline** Infisical project as `INSTANTDB_CLI_TOKEN`) |
| Schema + perms    | Pushed to `camplist-dev` from `instant.schema.ts` / `instant.perms.ts`                                                |

## Running it

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"   # only this node has working npm
cd ~/code/gibson-ops/_worktrees/camplist/rebuild-expo
npm install
cp mobile/.env.example mobile/.env    # then set EXPO_PUBLIC_INSTANT_APP_ID
npm run mobile
```

No sign-in is required. On first launch the app creates an InstantDB **guest session**
silently and bootstraps a household, so it's usable immediately and still syncs to the cloud.

## Auth model

Camp List is login-free to start:

1. First launch calls `db.auth.signInAsGuest()`. The guest is a real auth identity, so the
   CEL rules in `instant.perms.ts` apply normally.
2. The guest bootstraps its own profile, household, and first person client-side. This is
   why the permission rules allow self-service creation (see the KNOWN GAP note in
   `instant.perms.ts`).
3. Conversion happens **at the sharing moment**, not on a wall. When they sign in with a new
   email, Instant keeps the same user id and all guest-created data carries over with no
   migration.
4. If that email already belongs to an account, the old identity survives as a linked guest.
   The household rules also check `$user.linkedGuestUsers.profile.households.id` so merged
   users keep seeing what they made before signing up.

**Caveat worth knowing:** a guest session token lives in device-local storage. If the device
is lost or app data is cleared before they sign up, that data is gone. That's the argument
for prompting at the sharing moment rather than never.

## Pushing schema changes

```bash
TOKEN=$(cd ~/code/crossline && infisical-agent secrets get INSTANTDB_CLI_TOKEN --env=dev --plain)
npx instant-cli push all -a 6eaf2c74-0277-43e6-a105-c642e76778a8 -t "$TOKEN"
```

`infisical-agent` resolves projects by working directory and returns an **empty string**
rather than erroring when it can't. If a CLI call fails with
`Malformed parameter: ["headers" "authorization"]`, the token came back empty; that's why the
command above `cd`s into a repo that has a project mapping.

## iOS: why Expo Go does NOT work, and the development-build path

**Expo Go cannot run this project on iOS.** The App Store build of Expo Go is pinned to
**SDK 54** (the SDK 55 build has been stuck in Apple review since May 2026), and this project
is on SDK 57. Expo Go only loads projects matching its own SDK, so it fails no matter how many
times it's reinstalled. Android's Play Store build is current, which is why the emulator loads
it fine. This is an Apple-approval bottleneck, not a project misconfiguration.

The fix is a **development build**: a real app binary containing this project's native
modules, installed on the device, which then loads JS from the dev server exactly like Expo Go
did. It's also what Expo recommends for anything beyond learning, and it sidesteps the Expo Go
crash on the Android emulator too.

### One-time setup (needs Jared)

1. **Apple Developer Program** — <https://developer.apple.com/programs/> ($99/yr). Required to
   install a build on a physical iPhone. Enrollment can take 24-48h. This is needed for App
   Store release regardless, so it isn't extra spend.
2. **Expo account** — free, at <https://expo.dev>. Then `npx eas-cli login`.
3. `npx eas-cli init` in `mobile/` to create the EAS project and write its id.

### Building

```bash
cd mobile
npx eas-cli build --profile development --platform ios      # TestFlight / direct install
npx eas-cli build --profile development --platform android  # APK, sideload or emulator
```

`eas.json` already defines the profiles. The `development` profile sets
`developmentClient: true` and `distribution: internal`, which is what allows installing
outside the App Store. EAS will prompt for Apple credentials on the first iOS build and
manage signing itself.

Once installed, run `npx expo start --dev-client` and the build connects to the dev server the
same way Expo Go did (over tailnet, see below).

### Interim: reviewing on the phone without a build

The web build renders the same design system and is reachable over tailnet, which is enough
for design review though not for native behavior:

```bash
cd mobile && npx expo start --web --port 8093
# then on the iPhone: http://100.79.10.40:8093  (add /design for the component gallery)
```

## Testing on a real iPhone (over tailnet)

iOS is first class, but finn can't run an iOS simulator, so iOS verification happens on
Jared's actual phone. Both finn and `iphone-12-pro` are on the tailnet, so this needs no
public tunnel and no shared wifi.

```bash
cd mobile
REACT_NATIVE_PACKAGER_HOSTNAME=100.79.10.40 npx expo start --port 8081
```

Then on the iPhone, in **Expo Go → Enter URL manually**:

```
exp://100.79.10.40:8081
```

`REACT_NATIVE_PACKAGER_HOSTNAME` is the important part: without it Metro advertises a LAN
address the phone can't reach, and the app fails with
`java.io.IOException: Failed to download remote update` (or the iOS equivalent). Confirm the
server is advertising the right host with:

```bash
curl -s -H "Expo-Platform: ios" -H "Accept: application/expo+json,application/json" \
  http://100.79.10.40:8081 | python3 -c "import json,sys; print(json.load(sys.stdin)['extra']['expoClient']['hostUri'])"
# -> 100.79.10.40:8081
```

Treat "verified on Android/web" as PARTIAL. Platform divergence to re-check on iOS: safe-area
insets (use `<Screen>`, never hardcode top padding), `KeyboardAvoidingView` behavior, fonts,
shadows vs elevation, and haptics.

## Android emulator (for UI screenshots)

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

# Use the `camplist` AVD. The pre-existing `test-device` AVD has 96MB RAM and won't run an app.
setsid sg kvm -c "$ANDROID_HOME/emulator/emulator -avd camplist -no-window -no-audio \
  -no-boot-anim -gpu swangle_indirect -no-snapshot -no-metrics > /tmp/emulator.log 2>&1" &

# then, once sys.boot_completed == 1:
adb reverse tcp:8081 tcp:8081        # REQUIRED, and lost on every emulator restart
adb shell input keyevent KEYCODE_WAKEUP   # else screencap returns pure black
adb exec-out screencap -p > shot.png
```

Gotchas that each cost real time:

- `jared` must be in the `kvm` group (`sudo gpasswd -a jared kvm`). Already done, but a
  process started before that change won't have it, hence the `sg kvm -c` wrapper.
- **`-gpu swiftshader_indirect` segfaults** React Native's Fabric renderer (SIGSEGV with no
  redbox, app silently returns to the Expo Go home screen). Use `swangle_indirect`.
- Restarting the emulator drops `adb reverse`, and the app then fails with
  `java.io.IOException: Failed to download remote update`. Re-run the reverse command.

## Web

`mobile/lib/db.ts` has a `db.web.ts` sibling that Metro selects automatically for web,
because Instant ships separate packages per platform (`@instantdb/react-native` vs
`@instantdb/react`). Nothing else in the app imports an Instant SDK directly, which keeps
first-class web a one-file swap rather than a migration. See the note at the top of `db.ts`.
