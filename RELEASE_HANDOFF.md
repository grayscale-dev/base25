# Release Handoff Runbook

## 1) Platform Topology

- Supabase projects: `test`, `prod`
- Vercel project: single project, deployed by GitHub Actions only
- Branch model:
  - `main` = development/default
  - `master` = production release branch

## 2) GitHub Actions Workflows

### `deploy-test` (manual)
- Trigger: `workflow_dispatch`
- Input: `git_ref`
- Target: Supabase `test` + Vercel preview

### `deploy-prod` (automatic)
- Trigger: push to `master`
- Target: Supabase `prod` + Vercel production

## 3) Environment Secrets

Create GitHub Environments:
- `test`
- `prod`

Set these secrets in each environment:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Recommended:
- Require reviewers for `prod` environment.

## 4) Vercel Settings

Set in Vercel Project Settings:
1. Disable automatic Git-based preview and production deployments.
2. Keep the Git connection only for metadata if desired, but deployments should be CLI-driven from workflows.

## 5) Supabase Migration Strategy

- Canonical chain starts at:
  - `001_workspace_schema.sql`
  - `002_storage_uploads.sql`
- Schema is workspace-native only (no legacy compatibility layer).
- Data reset is assumed acceptable.

For fresh environment bootstrap:
```bash
supabase link --project-ref <PROJECT_REF> --password <DB_PASSWORD>
supabase db push --linked --yes
```

## 6) Local Hybrid Dev

### Local Supabase mode
```bash
cp .env.profiles/local.env.example .env.profiles/local.env
npm run env:local
supabase start
npm run dev
```

### Remote test Supabase mode
```bash
cp .env.profiles/remote-test.env.example .env.profiles/remote-test.env
npm run env:remote-test
npm run dev
```

## 7) Release Flow

1. Develop on `main`.
2. Run local checks:
```bash
npm run verify:release
```
3. Manually deploy candidate to test:
- Run `deploy-test`
- Set `git_ref` to branch/tag/SHA
4. Validate in preview + test Supabase.
5. Merge to `master` to release production.
6. `deploy-prod` executes automatically.

## 8) Rollback

### App + Functions rollback
1. Find prior known-good commit SHA.
2. Run `deploy-test` with that SHA for verification.
3. Cherry-pick/revert on `master` and push, or run a controlled rollback commit.

### Database rollback
- Use Supabase backup/point-in-time recovery for the affected environment (`test` or `prod`) if migration rollback is needed.

## 9) Verification Checklist

After each deploy:
1. Workspace create flow (`createWorkspace`) succeeds.
2. Slug check (`checkWorkspaceSlug`) succeeds.
3. Join by access code flow succeeds.
4. Workspace settings + role operations succeed.
5. Item CRUD and activity threads succeed.
6. Billing summary + checkout path succeeds.
7. No runtime legacy contract references remain.
