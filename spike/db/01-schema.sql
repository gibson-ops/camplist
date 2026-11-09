-- Spike schema: a cut-down Camp List (one household, one list, its items) plus presence.
-- Runs once, when the Postgres volume is first created.

CREATE TABLE households (
  id   uuid PRIMARY KEY,
  name text NOT NULL
);

-- Membership drives what each user syncs (see powersync/sync-config.yaml).
CREATE TABLE household_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households,
  user_id      text NOT NULL,
  UNIQUE (household_id, user_id)
);

CREATE TABLE lists (
  id           uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households,
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id           uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households,
  list_id      uuid NOT NULL REFERENCES lists ON DELETE CASCADE,
  name         text NOT NULL,
  state        text NOT NULL DEFAULT 'unpacked' CHECK (state IN ('unpacked', 'packed', 'loaded')),
  sort         integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text
);

-- Who has a list open. One row per (user, list); the id is '<user id>:<list id>'.
-- "Here now" means seen_at within the last 45 seconds, judged on the device.
CREATE TABLE presence (
  id           text PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households,
  list_id      uuid NOT NULL REFERENCES lists ON DELETE CASCADE,
  user_id      text NOT NULL,
  name         text NOT NULL,
  seen_at      timestamptz NOT NULL
);

-- PowerSync replicates only these tables; Better Auth's tables stay server-side.
CREATE PUBLICATION powersync FOR TABLE households, household_members, lists, items, presence;

-- Seed: one household, one trip list.
INSERT INTO households (id, name) VALUES ('6f1c1a52-0000-4000-8000-000000000001', 'Spike household');
INSERT INTO lists (id, household_id, name) VALUES
  ('6f1c1a52-0000-4000-8000-0000000000a1', '6f1c1a52-0000-4000-8000-000000000001', 'Mirror Lake');
INSERT INTO items (id, household_id, list_id, name, sort)
SELECT gen_random_uuid(), '6f1c1a52-0000-4000-8000-000000000001', '6f1c1a52-0000-4000-8000-0000000000a1', name, ord
FROM unnest(ARRAY['Tent', 'Sleeping bags', 'Camp stove', 'Fuel canister', 'Headlamps',
                  'Water filter', 'First aid kit', 'Bear spray']) WITH ORDINALITY AS t(name, ord);
