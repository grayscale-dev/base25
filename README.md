**Welcome to base25, go to www.base25.app to learn more**

## Local Development

- Node.js requirement: `>=18.18.0`
- Install deps: `npm install`
- Run app: `npm run dev`
- Run lint checks: `npm run lint`
- Run release preflight: `npm run verify:release`
- Production build: `npm run build`
- Start production server: `npm run start`

## Architecture

- System architecture and maintenance conventions: `ARCHITECTURE.md`
- Release checklist and deploy runbook: `RELEASE_HANDOFF.md`

### Environment Variables

Use Next.js public env names:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BASE44_APP_ID`
- `NEXT_PUBLIC_BASE44_FUNCTIONS_VERSION`
- `NEXT_PUBLIC_BASE44_APP_BASE_URL`
- `NEXT_PUBLIC_AUTH_PROVIDER`

The migration includes compatibility for legacy `VITE_*` names through `next.config.mjs`.

## Stripe Billing Setup

This project ships with Stripe billing based on enabled services. Follow the steps below for initial setup.

### 1) Create Stripe Products + Prices

Create 3 prices in Stripe (Test mode first):

- 3 service prices at **$25/month** (recurring):
  - Feedback
  - Roadmap
  - Changelog

Copy the **price IDs** for each service.

### 2) Configure Stripe Customer Portal

In Stripe Dashboard → Billing → Customer portal:
- Enable the portal
- Allow subscription + payment method management

### 3) Create a Stripe Webhook

Add a webhook endpoint:

- Prod: `https://<project-ref>.supabase.co/functions/v1/stripeWebhook`
- Local: `http://127.0.0.1:54321/functions/v1/stripeWebhook`

Subscribe to events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

Copy the **Webhook signing secret**.

### 4) Supabase Secrets

Set these secrets for Edge Functions:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_SERVICE_IDS` (JSON map or comma-delimited)

Example for `STRIPE_PRICE_SERVICE_IDS`:
```json
{
  "feedback": "price_...",
  "roadmap": "price_...",
  "changelog": "price_..."
}
```

### 5) Deploy Edge Functions

Deploy the billing-related functions:
```
supabase functions deploy createCheckoutSession
supabase functions deploy createBillingPortal
supabase functions deploy stripeWebhook
supabase functions deploy getBillingSummary
```

## GitHub Action: Supabase Deploy on Merge

The repo includes a workflow at `.github/workflows/supabase-deploy.yml` that runs on push to `main`/`master` and:
- runs `supabase db push --linked --yes`
- deploys changed edge functions under `supabase/functions/` (or all functions when `_shared` changes)

Required repository secrets:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`
