# KPIT

KPI and monthly reporting on Next.js (run by [vinext](https://vinext.dev) on Vite),
deployed to Cloudflare Workers with the `cf` CLI, with D1 for application data and
R2 for comment images. All Worker settings and bindings live in `cloudflare.config.ts`.

## Cloudflare Workers + D1

Use Node.js and `npm ci` (npm version pinned by `packageManager`). Runtime code uses the `DB` D1 binding,
not `kpit.db` or `DATABASE_URL`.

### Provisioning and configuration

The commands below create or modify Cloudflare resources. Run them deliberately
in the intended account; local development does not require provisioning them.

```bash
npx cf auth login   # or export CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID)
npx cf d1 create --help   # then create D1 `kpit`
# Put the database id in cloudflare.config.ts (env.DB) and in the d1:migrate:* scripts.
npx cf r2 bucket create --help   # then create R2 bucket `kpit-uploads`
# `cf` cannot set a single secret yet; wrangler can (it reads no config, so pass the name):
npx wrangler secret put AUTH_SECRET --name kpit
npx wrangler secret put AUTH_URL --name kpit
npx wrangler secret put AUTH_TRUST_HOST --name kpit
```

`cf deploy` replaces every binding that `cloudflare.config.ts` does not declare
(there is no `keep_vars` equivalent). Secrets that already exist on the Worker are
therefore declared there with `bindings.secret()` (the deploy keeps their values), and
the one plain variable, `DEEPSEEK_MODEL`, is declared with its value. When you add a
secret or variable, add it to `cloudflare.config.ts` in the same change.

Use a random `AUTH_SECRET` of at least 32 characters, `AUTH_URL` equal to the
canonical HTTPS application origin, and `AUTH_TRUST_HOST=true` on the
trusted Workers deployment (better-auth then accepts the request's own origin).
The names are unchanged from the next-auth setup, so no new secret is needed.

Optional runtime settings (secrets via `wrangler secret put <NAME> --name kpit`, except
`DEEPSEEK_MODEL`, which is a plain variable set in `cloudflare.config.ts`):

- `DEEPSEEK_API_KEY`: enables the AI features through the DeepSeek API
  (`https://api.deepseek.com`); not required for manual reports or HTML export.
- `DEEPSEEK_MODEL`: model name, `deepseek-flash` in `cloudflare.config.ts` (edit it there
  and redeploy; `.env.example` covers local use).

Secrets are not committed. `.env.example` lists the seed/AI settings; copy the
runtime values you need to an ignored `.dev.vars` for local development (declared secrets
missing from it, such as `DEEPSEEK_API_KEY`, only print a warning):

```dotenv
AUTH_SECRET=replace-with-a-random-local-secret-at-least-32-characters
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
```

For `npm run preview` (Worker on http://localhost:4173) set
`AUTH_URL=http://localhost:4173`. Without it the proxy treats the request as
HTTPS, looks for the `__Secure-` session cookie and bounces every login back to
`/login`; deployed HTTPS origins are unaffected.

`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are shell environment variables for
the seed script only, not Worker secrets. Password hashing uses native WebCrypto
PBKDF2-SHA256 (100000 iterations, the workerd maximum), measured at about 80 ms of
CPU locally. That does not fit the
[free plan's 10ms CPU allowance](https://developers.cloudflare.com/workers/platform/limits/#cpu-time),
so every password check is rate limited instead: sign-in allows 5 attempts per 60 s per
`cf-connecting-ip` and password change 5 per 15 min per user, both stored in D1 table `rate_limit`.

### Local development

```bash
npm run d1:migrate:local
# For a NEW database only; supply a strong password via your shell environment.
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD="$ADMIN_PASSWORD" npm run seed:admin -- --local
npm run dev
```

Open http://localhost:3000. `npm run dev` (Vite with the Cloudflare plugin) runs the
app in workerd with local D1/R2 bindings; persisted state is under
`.cloudflare/state`, which `d1:migrate:local` and
`seed:admin` without `--persist-to` also use. An explicit `--persist-to /absolute/dir`
isolates a rehearsal from the development database.

`seed:admin` requires exactly one of `--local` / `--remote`, supports
`--persist-to` with `--local`, skips an existing email, and never writes a
SQLite file. The old dated sample-data seed was removed: it was not an upgrade
path and would duplicate demo domains rather than preserve production data.

### Schema changes and deployment

```bash
npm run db:generate
npm run d1:migrate:local
# Review generated SQL and back up production before applying remotely.
npm run d1:migrate:remote
npm run deploy
```

Production deploys run automatically: Workers Builds (connected GitHub repo) builds
every push to `main` and deploys to https://kpit.mrfansi.dev. Configure its build
command as `npm run build` and its deploy command as
`npx cf deploy --prebuilt --mode production` (Workers Builds supplies the API
token). Apply any new migration with `d1:migrate:remote` **before** merging code
that needs it.

`npm run build` runs `vite build` and writes the deployable Build Output to
`.cloudflare/output/v0`. `npm run deploy` builds and deploys from your machine
(`vinext-cloudflare deploy`, which calls `cf deploy`; sign in with `npx cf auth login` or
set `CLOUDFLARE_API_TOKEN`). It does not apply migrations. `preview` builds and serves
the Worker locally; `cf-typegen` regenerates the binding types in `.cloudflare/types`.
`d1:migrate:*` use `cf d1 migrations apply` with the committed `drizzle/*.sql` files
and the `d1_migrations` ledger. `seed:admin` still shells out to the Wrangler CLI (cf has no `d1 execute --file` command), with a config generated from `cloudflare.config.ts`. Do not use `drizzle-kit push`: Workers only see schema
applied through `d1:migrate:*`. The old `db:migrate`, `db:studio` and `start`
npm commands are gone (they targeted `kpit.db` / a Node server).

## Design System

The UI follows the locked system in [`DESIGN.md`](DESIGN.md): the neutral "panel
instrumen" palette (hue only for KPI status and domain identity), one typeface
(IBM Plex Sans, with tabular `num` figures), bare tables, and one filled
primary action per screen. Values live in `src/app/tokens.css`; `src/app/globals.css`
maps the shadcn variable names onto them, so components keep using `bg-background`,
`text-muted-foreground`, `bg-success-soft` and friends.

## Dependency Notes

**better-auth** (`^1.7`) replaced next-auth v5. See [Authentication](#authentication).

## Authentication

Sign-in uses [better-auth](https://better-auth.com) with email + password
(`src/auth.ts`, handler at `src/app/api/auth/[...all]/route.ts`, client in
`src/lib/auth-client.ts`, route guard in `src/proxy.ts`). Sessions are stored in
D1 (`session` table, 30 days) with a 5-minute signed cookie cache, so a role
change or deleted user takes effect within 5 minutes. Sign-up is disabled: users
are created by admins (`/admin/users`) or `npm run seed:admin`. `users.role`
(`admin` | `viewer`) is never accepted from client input.

Passwords are `pbkdf2-sha256$100000$<salt>$<key>` (`src/lib/password.ts`).
Legacy bcrypt hashes from the old next-auth setup still verify and are rehashed
on the user's next successful login. A rollback to the old worker therefore breaks
logins for every user who has signed in since PR #16 (it cannot verify PBKDF2 hashes); they need a password reset. Migration `0017_better_auth.sql` adds
`session`/`account`/`verification` and three columns on `users`, then backfills
one `credential` account per user (`account.password` = `users.password_hash`)
and lower-cases stored emails (better-auth looks users up by lower-cased email;
a row that would collide with another is left unchanged).

**`users.password_hash` stays NOT NULL and must stay in sync with
`account.password`**: every password write (`createUser`, `updateUserPassword`
in `src/lib/db/users.ts`, `seed:admin`) writes both, so the previous next-auth
worker can still log in users who have not signed in since PR #16 after a rollback. If a rollback window lets the
old worker create users or change passwords, re-sync before going forward again:

```sql
INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
  SELECT lower(hex(randomblob(16))), id, 'credential', id, password_hash, created_at, unixepoch() FROM users
  WHERE true ON CONFLICT (provider_id, account_id) DO UPDATE SET password = excluded.password, updated_at = excluded.updated_at;
```

Rollout order: apply the migration to the database first (it is additive, so
the running old worker is unaffected), then deploy. Sessions issued by
next-auth are not valid for better-auth: everyone signs in once after the
deploy.

## Monthly Reports

The platform supports the internal monthly-report memo dated October 4, 2026.
Open **Laporan Bulanan** in the admin navigation (`/admin/reports/monthly`),
choose an existing domain and month, and explicitly map it to a memo division.

- Save a revisioned report snapshot with 2–4 main points plus one worst outcome
  (3–5 summary points total), KPI definitions/targets, deviation evidence,
  risks/escalation owners, next-month actions/PIC/deadlines, and optional C-level
  decisions. Editing the report does not overwrite the original KPI entries.
- Current and previous observations use exact reporting months. YTD supports
  explicitly chosen sum, average, month-end value, or numerator/denominator
  ratio; missing inputs are never replaced with zero or estimated. Known targets
  remain available independently of untracked actuals.
- Cite actuals, targets, and narrative numbers. Confirm untracked metrics as
  `belum dilacak`. Declare shared metric keys to reconcile sourced current,
  previous, and YTD figures across saved division reports.
- Save incomplete drafts and answer the displayed clarification questions.
  Final HTML presentation is blocked until required facts and confirmations are
  complete. Unsaved edits cannot be exported as if they were saved.
- Core decks contain 6 slides (7 with decisions), Finance 9 (10 with decisions,
  including income statement, cash flow, and balance sheet), and HR & Strategic
  Partnership 5. Allow approximately 10–15 minutes per division.
- Appendix history, raw data, channel breakdowns, and non-KPI activities are
  separate from core slides and their counter. **Buka lampiran** opens them;
  **Cetak mode ini** prints either the core deck or appendix mode.

The read-only report (`/report/{domain}?period=YYYY-MM-01`), domain Markdown
exports, presentation prompt, and HTML deck all use the same saved snapshot.
The portfolio report still provides raw organization-wide `full`/`brief` exports;
presentation exports require a selected domain.

**Periksa / Bantu dengan AI** returns clarification questions before making any
provider call. Once a saved report is complete, it can generate factual draft
speaker notes using the DeepSeek configuration in `.env.example`. No configured provider returns an explicit unavailable error;
manual reporting and deterministic HTML export do not require AI. Review AI
notes before use. The exported presentation prompt also supports clarification
in an external conversational AI tool.

### Database upgrades

Apply D1 migrations before deploying code that depends on the new schema, as
described in **Cloudflare Workers + D1** above. 