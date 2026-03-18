# The Walking Books

Community book-sharing platform where readers discover, reserve, and pick up physical books from partner locations.

## Stack
- **Runtime**: Bun
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, shadcn/ui
- **Backend**: Convex (real-time database, server functions, file storage, crons)
- **Auth**: Clerk (keyless mode, phone OTP)
- **Monorepo**: Turborepo

## Development

```bash
# Install dependencies
bun install

# Start Convex dev server (terminal 1)
cd apps/web && bunx convex dev

# Start Next.js dev server (terminal 2)
cd apps/web && bun run dev
```

## Project Structure
- `apps/web/` — Next.js application
- `apps/web/convex/` — Convex backend (schema, queries, mutations, actions, crons)
- `apps/web/components/` — Reusable UI components
- `apps/web/app/` — App Router pages
  - `(reader)/` — Authenticated reader pages (dashboard, share, settings)
  - `partner/` — Partner dashboard (role-guarded)
  - `admin/` — Admin panel (role-guarded)

## Conventions
- Strict TypeScript, named exports
- shadcn/ui for UI components, Lucide for icons
- Convex: static imports only, internalAction for external API calls
- Auth: Clerk keyless mode (no API keys needed for dev)
