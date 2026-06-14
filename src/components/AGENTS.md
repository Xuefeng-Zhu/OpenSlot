# src/components/

React UI components: dashboard views, guest booking flow, shadcn-style primitives, landing page.

## STRUCTURE

```
src/components/
├── dashboard/    Host dashboard views (37 files): event types, bookings, contacts, settings, availability, onboarding
├── booking/      Guest booking flow (28 files): event selection, date/time picker, guest form, hold timer, confirmation, cancel
├── ui/           shadcn-style local primitives (22 files): button, dialog, drawer, select, dropdown, toast, label, tabs, etc.
├── shared/       Cross-feature UI helpers (7 files): timezone picker, loading states, error boundaries
├── landing/      Landing page components (6 files)
└── auth/         Auth form components (1 file)
```

## WHERE TO LOOK

| Task | Location |
| --- | --- |
| Add host dashboard view | `dashboard/` |
| Modify guest booking flow | `booking/` |
| Add UI primitive | `ui/` (scaffold from `components.json`) |
| Cross-feature helper (timezone, loading, error) | `shared/` |
| Edit landing page section | `landing/` |
| Edit sign-in / sign-up forms | `auth/` |

## CONVENTIONS

- `"use client"` only if the file uses hooks, browser APIs, or event handlers. Dashboard views and booking flow run client-heavy; ui primitives are all client.
- Import primitives from `@/components/ui/<name>`. Use `cn()` from `@/lib/utils` for className merging.
- Keep route pages in `src/app/(dashboard)/` thin; push rendering into `dashboard/` components.
- Booking components: `react-hook-form` for state, Zod for validation.
- Tests co-located in `__tests__/` per subdir.

## DASHBOARD VIEWS

- Imported by route pages in `src/app/(dashboard)/`.
- Some surfaces still prototype/mock-backed. Check before extending.
- Event type list/new/edit views are Butterbase-backed: server fetch + `/api/event-types` mutations.
- Settings has prototype portions. Verify before changes.

## BOOKING COMPONENTS

- Public-facing, no auth required.
- All mutations hit route handlers: `/api/holds`, `/api/bookings`, `/api/slots`.
- Key pieces: event type list, date/time picker, guest info form, hold timer, confirmation, cancel.
- Cloudflare Turnstile widget in the booking form when configured.

## UI PRIMITIVES

- Generated from shadcn-style scaffold (`components.json`).
- Radix UI under the hood (Dialog, Popover, Select, Dropdown, Tabs, Drawer).
- Theme via Tailwind v4 CSS variables + `tailwind.config.js` extensions.
- A11y tests exist for icons, labels, focus, and drawer.

## ANTI-PATTERNS

- Never import `createAdminBackendClient` or `BUTTERBASE_API_KEY` into client components.
- Never use `as any` or `@ts-ignore`.
- Never import from `next/headers` or `next/navigation` in pure presentational components.
- No global state. Use local `useState` / `useMemo` / `useCallback` per component.
- Never import server-only modules (`src/lib/backend/server.ts`, `src/lib/backend/admin-client.ts`) into components.
