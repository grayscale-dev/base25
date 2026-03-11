# base25

Enterprise feedback platform running on Next.js + Supabase (workspace-native contracts).

## Environment Topology

This repo is designed for three execution modes:

1. Local app + local Supabase (`supabase start`)
2. Local app + hosted Supabase test project
3. Production app + hosted Supabase prod project

Hosted Supabase projects:
- `test` (staging/integration)
- `prod` (production)

## Branch + Release Model

- Default development branch: `main`
- Production release branch: `master`
- Test deploys: manual GitHub workflow dispatch (`deploy-test`), any ref
- Prod deploys: automatic on push to `master` (`deploy-prod`)

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Create env profile files:
```bash
cp .env.profiles/local.env.example .env.profiles/local.env
cp .env.profiles/remote-test.env.example .env.profiles/remote-test.env
```

3. Switch env profile:
```bash
npm run env:local
# or
npm run env:remote-test
```

4. (Local Supabase mode) start Supabase:
```bash
supabase start
```

5. Run app:
```bash
npm run dev
```

## Authentication Model

- Marketing routes are public: `/`, `/about`, `/features`, `/pricing`, `/auth/sign-in`
- All app routes require authentication and redirect to `/auth/sign-in?returnTo=...`
- Sign-in is OTP-only (email + 6-digit code); no Google/password flows

Supabase Auth settings (test + prod):
- Enable Email auth
- OTP length: `6`
- OTP expiry: `600` seconds
- Disable external OAuth providers (including Google)

## Quality + Verification

```bash
npm run lint
npm run build
npm run verify:release
```

`verify:release` enforces:
- no Radix imports
- no removed legacy feature surfaces
- no legacy runtime contract references
- no stale removed edge-function artifacts

## Supabase (Workspace-Native)

Canonical schema objects are workspace-native:
- `workspaces`
- `workspace_roles`
- `workspace_access_rules`
- `workspace_access_codes`
- `items`, `item_activities`, `item_status_groups`, `item_statuses`
- `billing_customers`, `billing_services`

Primary edge functions:
- `createWorkspace`
- `checkWorkspaceSlug`
- `publicGetWorkspace`
- `joinWorkspaceWithAccessCode`
- `getWorkspaceAccessCodeStatus`
- `setWorkspaceAccessCode`
- `publicTrackWorkspaceView`

### Deploy Supabase manually

```bash
supabase link --project-ref <PROJECT_REF> --password <DB_PASSWORD>
supabase db push --linked --yes
```

## GitHub Actions CI/CD

Workflows:
- `.github/workflows/deploy-test.yml`
- `.github/workflows/deploy-prod.yml`

Both workflows run:
1. checkout
2. `npm ci`
3. `npm run lint`
4. `npm run build`
5. `supabase link`
6. `supabase db push --linked --yes`
7. Supabase function deploy
8. Vercel deploy via CLI

## Required GitHub Environment Secrets

Configure these in both `test` and `prod` environments:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Also configure app/runtime secrets in Vercel and Supabase as needed (Stripe + Next public envs).

## Vercel Deployment Source

This repo expects **workflow-driven Vercel deployments only**.
Disable automatic Git-triggered Vercel deployments in project settings and use only:
- `deploy-test` workflow for preview deployments
- `deploy-prod` workflow for production deployments
