# Release Handoff Checklist

## Scope Snapshot
- Runtime: Next.js App Router on Vercel.
- UI layer: PrimeReact-backed wrappers under `src/components/ui/*`.
- Billing model: Flat `$25/month` per enabled service (`feedback`, `roadmap`, `changelog`).
- Removed features: Docs, Support Inbox, Beta/Waitlist, usage-based billing/metering.

## Required Environment Variables

### Public
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BASE44_APP_ID`
- `NEXT_PUBLIC_BASE44_FUNCTIONS_VERSION`
- `NEXT_PUBLIC_BASE44_APP_BASE_URL`
- `NEXT_PUBLIC_AUTH_PROVIDER`

### Server/Edge
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_SERVICE_IDS`

## Pre-Deploy Verification
Run from repo root:

```bash
npm run verify:release
```

This enforces:
- lint
- production build
- no Radix references in app code
- no Docs/Support references in guarded runtime paths
- no Beta/Waitlist references in guarded runtime paths

## Manual Smoke Checklist

### Routes
- `/`
- `/Workspaces`
- `/Feedback`
- `/Roadmap`
- `/Changelog`
- `/Billing`
- `/board/<slug>/feedback`
- `/board/<slug>/roadmap`
- `/board/<slug>/changelog`
- `/board/<slug>/settings`
- `/board/<slug>/api`

### Hard 404 checks
- `/Docs`
- `/Support`
- `/board/<slug>/docs`
- `/board/<slug>/support`

### Billing checks
- Pricing copy is flat-rate only.
- Billing page total = `enabled services × $25`.
- Checkout starts only with at least one enabled service.
- No usage/overage/interactions terminology in billing UI.

### Role/Access checks
- Admin-only controls: settings, API token management, roadmap moderation.
- Public/read-only board access prompts login for contribution actions.

## Deploy Steps (Vercel + Supabase)
1. Confirm env vars are set in Vercel and Supabase.
2. Deploy Supabase edge functions used by runtime:
   - `createCheckoutSession`
   - `createBillingPortal`
   - `stripeWebhook`
   - `getBillingSummary`
   - board/feedback/roadmap/changelog supporting functions currently referenced by client.
3. Deploy app to Vercel.
4. Run manual smoke checklist in preview.
5. Promote to production.

## Post-Deploy Monitoring
- Watch Vercel function logs for board route + billing calls.
- Watch Supabase edge logs for checkout/webhook failures.
- Validate Stripe webhook delivery status and event processing.

## Known Notes
- Build is configured to skip lint during `next build`; lint remains enforced by `npm run lint` and `npm run verify:release`.
- Legacy `VITE_*` env compatibility mapping remains in `next.config.mjs` for rollout safety.
