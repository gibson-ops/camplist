# Camp List — setup

Two accounts back this app: **Clerk** (identity) and **InstantDB** (data + sync + permissions).
Everything else runs locally.

## What already exists

| Thing | Value |
| --- | --- |
| InstantDB dev app | `camplist-dev` — appId `6eaf2c74-0277-43e6-a105-c642e76778a8` |
| Instant account | `jared@gibsonops.com` (Gibson Ops-wide; the CLI token lives in the **crossline** Infisical project as `INSTANTDB_CLI_TOKEN`) |
| Schema + perms | Already pushed to `camplist-dev` from `instant.schema.ts` / `instant.perms.ts` |

The Instant admin token for `camplist-dev` is **not** in Infisical yet — see "Remaining setup" below.

## Remaining setup (needs Jared — dashboard access)

### 1. Create the Clerk application

Clerk has no public API for creating an application, so this is dashboard-only.

1. <https://dashboard.clerk.com> → **Create application**
   - Name: `Camp List`
   - Sign-in options: **Email** only, with **Email verification code** (not magic link, not password).
     Apple/Google can be added later; the App Store requires Sign in with Apple *if* any other
     social provider is enabled, so adding Google means adding Apple too.
2. **Configure → Sessions → Customize session token** → edit the claims to include:
   ```json
   {
     "email": "{{user.primary_email_address}}",
     "email_verified": "{{user.email_verified}}"
   }
   ```
   InstantDB reads `email` off the verified JWT — without this claim the token exchange fails.
3. Copy the **Publishable key** (`pk_test_…`) from **API keys**.

### 2. Register Clerk with InstantDB

```bash
TOKEN=$(cd ~/code/crossline && infisical-agent secrets get INSTANTDB_CLI_TOKEN --env=dev --plain)
cd ~/code/gibson-ops/_worktrees/camplist/rebuild-expo
npx instant-cli auth client add \
  --type clerk \
  --name clerk \
  --publishable-key pk_test_... \
  -a 6eaf2c74-0277-43e6-a105-c642e76778a8 \
  -t "$TOKEN"
```

The `--name` must match `EXPO_PUBLIC_INSTANT_CLERK_CLIENT_NAME` (default `clerk`).

### 3. Fill in the app env

```bash
cp mobile/.env.example mobile/.env
# EXPO_PUBLIC_INSTANT_APP_ID=6eaf2c74-0277-43e6-a105-c642e76778a8
# EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 4. Move secrets into Infisical (recommended)

There's no `camplist` Infisical project yet, and the machine identity can't create one.
Create the project, add `camplist` → its projectId in `~/code/_env/infisical/projects.json`,
then store `INSTANTDB_ADMIN_TOKEN` (for `camplist-dev`) and `CLERK_SECRET_KEY` there. Until
then the admin token only lives wherever you paste it — treat the dev app as disposable.

## Running it

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"   # only this node has working npm
cd ~/code/gibson-ops/_worktrees/camplist/rebuild-expo
npm install
npm run mobile        # then scan the QR with Expo Go, or press `i` for a simulator
```

Sign in with any email; Clerk sends a 6-digit code. The spike screen then shows whether the
Instant session was minted from the Clerk token.

## What "spike passes" means

On `app/(app)/index.tsx` you should see:

1. **Clerk session** — signed in, your email.
2. **Instant session** — a non-empty `auth.id`, the same email, `emails match = true`.
   *This is the thing being de-risked.* If this is empty, the token exchange failed — check
   that the session-token claims from step 1.2 are saved and the client name matches.
3. **Permissioned query** — status `ok`. `profile row: none yet` is EXPECTED until the
   household bootstrap runs; it proves the rules are live rather than that data exists.

## Pushing schema changes

```bash
TOKEN=$(cd ~/code/crossline && infisical-agent secrets get INSTANTDB_CLI_TOKEN --env=dev --plain)
npx instant-cli push all -a 6eaf2c74-0277-43e6-a105-c642e76778a8 -t "$TOKEN"
```

`infisical-agent` resolves projects by working directory, and it returns an **empty string**
rather than erroring when it can't — hence the `cd ~/code/crossline` subshell. If a CLI call
fails with `Malformed parameter: ["headers" "authorization"]`, the token came back empty.
