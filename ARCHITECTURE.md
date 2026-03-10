# Base25 Architecture

## Overview
Base25 is a Next.js App Router application for product feedback operations across three core services:
- Feedback
- Roadmap
- Changelog

The app is intentionally client-first for product parity, with server routing and deployment through Next/Vercel.

## Route Model

### Public routes
- `/`
- `/Home`
- `/About`
- `/Features`
- `/Pricing`

### Authenticated workspace routes
- `/Workspaces`
- `/JoinWorkspace?board=<slug>`

### Board routes
- `/board/[slug]/feedback`
- `/board/[slug]/roadmap`
- `/board/[slug]/changelog`
- `/board/[slug]/settings`
- `/board/[slug]/api`

Board URLs are canonical. Feature screens are mounted through App Router pages and rendered inside the shared layout shell.

## Runtime State Model

### Session context
Board selection and role context are stored in session storage via:
- `src/lib/board-session.js`

Primary keys:
- selected board object/id
- board role (`viewer` | `contributor` | `admin`)
- public-access flag
- analytics session id

### Board provider
- `src/components/context/BoardContext.jsx`

Responsibilities:
- load board context from route slug + API
- resolve current user and permission model
- expose consistent UI messages for login/access states

## UI Composition

### Layout shell
- `src/Layout.jsx` handles:
  - top navigation
  - workspace switcher
  - role-aware action visibility
  - board-provider wrapping for board pages

### Shared page primitives
- `PageShell`, `PageHeader`: `src/components/common/PageScaffold.jsx`
- `StateBanner`, `StatePanel`: `src/components/common/StateDisplay.jsx`
- `PageLoadingState`: `src/components/common/PageLoadingState.jsx`
- `ConfirmDialog`: `src/components/common/ConfirmDialog.jsx`

Use these before introducing new ad hoc wrappers.

## Error and Loading Boundaries

App Router boundaries:
- global loading: `app/loading.jsx`
- route error: `app/error.jsx`
- global fatal error: `app/global-error.jsx`
- board route loading/error:
  - `app/board/[slug]/[section]/loading.jsx`
  - `app/board/[slug]/[section]/error.jsx`

Screen-level data failures should use `StatePanel` with retry actions.

## Data and Integrations

### Client API surface
- `base44` SDK usage in feature screens/components
- Supabase Edge Functions invoked through SDK for privileged operations

### Billing model
- Flat pricing only: `$25 / month / enabled service`
- Services: `feedback`, `roadmap`, `changelog`
- No usage-based billing or interaction metering

## Permission Contract

Valid board roles:
- `viewer`
- `contributor`
- `admin`

Staff-only behavior is admin-only in current implementation.

## Development Commands
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run start`

## Maintenance Rules
- Keep route behavior stable for existing URLs.
- Prefer shared state/loading/error primitives over one-off UI.
- Keep destructive flows on `ConfirmDialog`.
- Avoid browser-native `alert/confirm` in runtime UX.
