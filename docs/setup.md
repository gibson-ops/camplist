# Camp List — setup

One account backs this app: **InstantDB** (data, sync, auth, permissions). There is no
separate auth provider, and no dashboard step before you can run it.

## What already exists

| Thing | Value |
| --- | --- |
| InstantDB dev app | `camplist-dev` — appId `6eaf2c74-0277-43e6-a105-c642e76778a8` |
| Instant account | `jared@gibsonops.com` (Gibson Ops-wide; CLI token is in the **crossline** Infisical project as `INSTANTDB_CLI_TOKEN`) |
| Schema + perms | Pushed to `camplist-dev` from `instant.schema.ts` / `instant.perms.ts` |

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
