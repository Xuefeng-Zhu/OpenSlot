# OpenSlot

**Share availability. Book time. Stay in sync.**

OpenSlot is an MVP scheduling platform that enables hosts to define weekly availability, create event types, and share public booking pages. Guests can view available slots, temporarily hold a slot, and confirm bookings — all with database-level anti-double-booking guarantees via PostgreSQL exclusion constraints.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Database & Auth | Supabase (Auth, Postgres, RLS) |
| Styling | Tailwind CSS + shadcn/ui |
| Forms & Validation | React Hook Form + Zod |
| Date/Time | date-fns + date-fns-tz |
| Testing | Vitest + fast-check (property-based) |

## Prerequisites

- [Node.js](https://nodejs.org/) 20.9+ and npm
- A [Supabase](https://supabase.com/) project (free tier works)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local development and running migrations)

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd openslot
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Configure environment variables

Copy the example environment file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

You can find these values in your Supabase project dashboard under **Settings → API**.

The public landing page can render without Supabase credentials for local UI work, but authentication, dashboard, booking, and API routes require these environment variables.

### 4. Run database migrations

Apply the migrations to your Supabase project using the Supabase CLI:

```bash
supabase db push
```

Or run them manually via the Supabase SQL Editor by executing each file in `supabase/migrations/` in order.

### 5. Seed the database (optional)

Load sample data for development:

```bash
supabase db seed
```

Or run `supabase/seed.sql` manually in the SQL Editor. This creates a demo user with event types, availability rules, and a sample booking.

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build using the webpack builder |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |

For deterministic installs, prefer `npm ci` when working from the committed lockfile.

## Architecture Overview

OpenSlot follows a **server-first architecture** for critical booking operations:

- **Server Components** render public booking pages and dashboard views with data fetched directly from Supabase.
- **API Routes** (`/api/*`) handle all write operations for bookings and holds using the Supabase service role client, ensuring data integrity and security.
- **Client Components** handle interactive UI (forms, date pickers, slot selection) and communicate with API routes for mutations.
- **Proxy** (`src/proxy.ts`) refreshes Supabase sessions and redirects unauthenticated dashboard requests.
- **Row-Level Security (RLS)** enforces data access at the database level — hosts can only access their own data, while guests can read public profiles and event types.
- **PostgreSQL Exclusion Constraints** provide database-level anti-double-booking guarantees, preventing overlapping confirmed bookings even under concurrent requests.

### Request Flow

1. Guest visits a public booking page → Server Component fetches host profile and event types
2. Guest selects a date → Client fetches available slots from `/api/slots`
3. Guest picks a slot → Client creates a temporary hold via `/api/holds` (5-minute TTL)
4. Guest submits booking form → Client confirms via `/api/bookings` (validates hold, inserts booking, enqueues side-effect events, sends current console-provider emails)

## Directory Structure

```
openslot/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Auth pages (login, signup)
│   │   ├── (dashboard)/         # Protected dashboard pages
│   │   │   ├── availability/    # Weekly availability management
│   │   │   ├── bookings/        # Booking list and management
│   │   │   ├── dashboard/       # Overview page
│   │   │   ├── event-types/     # Event type CRUD
│   │   │   └── profile/         # Profile settings
│   │   ├── (public)/            # Public booking pages
│   │   │   └── [username]/      # Host profile and event pages
│   │   ├── api/                 # API routes
│   │   │   ├── bookings/        # Booking confirmation and cancellation
│   │   │   ├── holds/           # Slot hold creation
│   │   │   └── slots/           # Available slot computation
│   │   ├── booking/             # Cancellation pages
│   │   └── page.tsx             # Landing page
│   ├── components/
│   │   ├── booking/             # Booking flow components
│   │   ├── dashboard/           # Dashboard-specific components
│   │   └── ui/                  # shadcn/ui components
│   ├── lib/
│   │   ├── availability/        # Slot computation engine
│   │   ├── booking/             # Booking confirmation and cancellation logic
│   │   ├── email/               # Email service abstraction
│   │   ├── idempotency/         # Request replay protection for booking mutations
│   │   ├── outbox/              # Internal side-effect event enqueue helpers
│   │   ├── supabase/            # Supabase client utilities
│   │   ├── types/               # TypeScript type definitions
│   │   ├── utils/               # Shared utilities (slug, timezone)
│   │   └── validations/         # Zod validation schemas
│   └── proxy.ts                 # Auth proxy for protected routes
├── supabase/
│   ├── migrations/              # Database migration files
│   └── seed.sql                 # Sample data for development
├── .env.example                 # Environment variable template
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

## Key Features

- **Authentication** — Email/password sign up and login via Supabase Auth
- **Onboarding** — Persist profile setup, initial weekly availability, and the first active event type
- **Event Types** — Hosts can create, edit, delete, pause, and share Supabase-backed event types from the dashboard
- **Weekly Availability** — Set recurring availability windows per weekday with timezone support
- **Date Overrides** — Mark specific dates as unavailable or set custom hours
- **Public Booking Pages** — Shareable URLs (`/username/event-slug`) for guests to book
- **Slot Holds** — 5-minute temporary holds prevent race conditions during booking
- **Anti-Double-Booking** — PostgreSQL exclusion constraints guarantee no overlapping confirmed bookings
- **Idempotent Mutations** — Booking confirmation and cancellation cache idempotency-key responses for safe retries
- **Outbox Events** — Booking confirmation and cancellation write deduped side-effect events for future workers
- **Email Notifications** — Confirmation and cancellation email plumbing exists and uses a console provider by default
- **Cancellation** — Token-based public cancellation page and API for guests and hosts
- **Timezone Support** — Full IANA timezone handling with correct DST transitions

## Additional Documentation

- [Agent and contributor guide](AGENTS.md)
- [Product overview](docs/product-overview.md)
- [Architecture](docs/architecture.md)
- [Development](docs/development.md)
- [Testing](docs/testing.md)
- [Security](docs/security.md)
- [Release notes](docs/release.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Contributing](docs/contributing.md)
- [Agent workflow](docs/agent-workflow.md)

## License

Private — All rights reserved.
