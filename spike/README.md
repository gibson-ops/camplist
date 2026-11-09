# PowerSync spike

Can Camp List leave InstantDB for Postgres + PowerSync? Plan and results:
https://claude.ai/artifact/7Xqz9PqX91WNnk1zoCLMdE

Everything runs on finn, behind argo:

| Piece | Where | Start |
|---|---|---|
| Postgres 17 (`wal_level=logical`) | `localhost:5440`, db `camplist` | `docker compose up -d` (here) |
| PowerSync service 1.28.1 | `cl-sync-powersync` (:5172) | same compose file |
| API: Better Auth + upload endpoint | `cl-api-powersync` (:3001) | `cd api && argo run cl-api-powersync -- ./node_modules/.bin/tsx watch src/index.ts` |
| Metro for the dev build | `cl-native` (:8094) | from `mobile/`: `argo run cl-native -- env EXPO_PUBLIC_POWERSYNC_SPIKE=1 EXPO_PACKAGER_PROXY_URL=https://cl-native.argo.gibsonops.com ../node_modules/.bin/expo start --dev-client --port {port}` |

First run of the API: `cd api && npm install && npm run migrate` (creates Better Auth's tables).
`db/*.sql` runs once, when the Postgres volume is created; `docker compose down -v` resets it.

The app's spike screen is `mobile/app/spike.tsx`; `EXPO_PUBLIC_POWERSYNC_SPIKE=1` makes
`app/index.tsx` redirect there. Client setup is in `mobile/spike/powersync.ts`.
