# Architecture Overview

## Runtime Stack

- Frontend: Next.js App Router
- Styling: Tailwind + PrimeReact in unstyled mode
- Backend: Supabase Postgres + Supabase Edge Functions
- Hosting: Vercel (workflow-driven deploys)

## URL Structure

### Marketing routes (canonical lowercase)
- `/`
- `/about`
- `/features`
- `/pricing`

### App routes
- `/workspaces`
- `/join-workspace`
- `/workspace-settings`
- `/billing`

### Workspace routes
- `/workspace/[slug]/all` (admin only)
- `/workspace/[slug]/feedback`
- `/workspace/[slug]/roadmap`
- `/workspace/[slug]/changelog`
- `/workspace/[slug]/item/[itemId]`

## Session + Context Model

Workspace selection and role context are stored in session storage via:
- `src/lib/workspace-session.js`

Stored values:
- selected workspace object/id
- workspace role (`viewer` | `contributor` | `admin`)
- public access flag

Workspace context provider:
- `src/components/context/WorkspaceContext.jsx`

Responsibilities:
- resolve workspace context from route slug + API
- derive role-based permissions
- expose refreshable workspace/user state

## Data Model (Supabase)

Core tables:
- `workspaces`
- `workspace_roles`
- `workspace_access_rules`
- `workspace_access_codes`
- `items`
- `item_activities`
- `item_status_groups`
- `item_statuses`
- `billing_customers`
- `billing_services`
- `api_tokens`
- `audit_logs`

## Edge Function Surface

Workspace access and lifecycle:
- `createWorkspace`
- `checkWorkspaceSlug`
- `publicGetWorkspace`
- `joinWorkspaceWithAccessCode`
- `getWorkspaceAccessCodeStatus`
- `setWorkspaceAccessCode`
- `publicTrackWorkspaceView`

Item operations:
- `listItems`
- `createItem`
- `updateItem`
- `deleteItem`
- `listItemActivities`
- `createItemActivity`
- `getItemStatusConfig`
- `upsertItemStatusGroup`
- `upsertItemStatus`
- `deleteItemStatus`

Billing operations:
- `getBillingSummary`
- `createCheckoutSession`
- `createBillingPortal`
- `stripeWebhook`

Account operations:
- `updateUserProfile`
- `deleteMyAccount`

## UI Composition

- Global shell: `src/Layout.jsx`
- Workspace list: `src/screens/Workspaces.jsx`
- Workspace section screen: `src/screens/Workspace.jsx`
- Workspace settings: `src/screens/WorkspaceSettings.jsx`
- Unified items controller: `src/screens/items/useItemsController.js`
- Item detail surfaces:
  - drawer: `src/screens/items/ItemDetailDrawer.jsx`
  - full page: `src/screens/items/WorkspaceItemView.jsx`

## Security Baseline

- Service-role key is server-only (Supabase functions/server runtime)
- Client uses anon key + user JWT
- Role checks centralized in `supabase/functions/_shared/authHelpers.ts`
- Workspace read checks centralized in `supabase/functions/_shared/itemAccess.ts`
