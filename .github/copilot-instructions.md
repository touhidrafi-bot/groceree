# Groceree AI Coding Guidelines

## Project Overview
Groceree is a Next.js-based grocery delivery platform using Supabase for backend services (auth, database, storage) and Stripe for payments. The app features admin, driver, and customer interfaces with real-time order management.

## Architecture
- **Frontend**: Next.js App Router with TypeScript, Tailwind CSS for styling.
- **API Layer**: Server-side API routes in `app/api/` handle business logic and Supabase interactions.
- **Backend**: Supabase provides database, authentication, and file storage.
- **Data Flow**: UI components call API routes, which query Supabase; real-time updates via Supabase subscriptions.

Key directories:
- `app/`: Pages and API routes (e.g., `app/admin/`, `app/api/weekly-deals/`)
- `components/`: Reusable UI (e.g., `components/admin/WeeklyDealsForm.tsx`)
- `lib/`: Utilities and types (e.g., `lib/auth.ts` for Supabase client, `lib/types/supabase.ts` for generated types)

## Key Patterns
- **Typed Supabase**: Use generated types from `lib/types/supabase.ts`; client initialized in `lib/auth.ts`.
- **Null Safety**: Database fields are nullable; use `??` for defaults (e.g., `item.products?.image_url ?? undefined` in `app/orders/page.tsx`).
- **Error Handling**: Catch Supabase errors; display user-friendly messages.
- **Component Structure**: Separate concerns (e.g., forms in `components/admin/`, pages in `app/`).

## Workflows
- **Development**: `npm run dev` or `pnpm dev` starts dev server.
- **Build**: `npm run build` compiles TypeScript; ensure null checks for Supabase fields.
- **Debugging**: Check Supabase dashboard for data; use browser dev tools for UI issues.
- **Testing**: No automated tests; manual testing via UI and API calls.

## Conventions
- **Imports**: Relative paths; import types from `lib/types/supabase.ts`.
- **Styling**: Tailwind classes; avoid custom CSS.
- **Commits**: Use conventional commits for features/bugs.

Reference: `lib/auth.ts` for client setup, `app/api/weekly-deals/route.ts` for API pattern.