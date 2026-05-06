# OpenSlot

**Share availability. Book time. Stay in sync.**

OpenSlot is an MVP scheduling platform that enables hosts to define weekly availability, create event types, and share public booking pages. Guests can view available slots, temporarily hold a slot, and confirm bookings — all with database-level anti-double-booking guarantees via PostgreSQL exclusion constraints.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict mode) |
| Database & Auth | Supabase (Auth, Postgres, RLS) |
| Styling | Tailwind CSS + shadcn/ui |
| Forms & Validation | React Hook Form + Zod |
| Date/Time | date-fns + date-fns-tz |
| Testing | Vitest + fast-check (property-based) |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
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
npm install
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
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |

## Architecture Overview

OpenSlot follows a **server-first architecture** for critical booking operations:

- **Server Components** render public booking pages and dashboard views with data fetched directly from Supabase.
- **API Routes** (`/api/*`) handle all write operations for bookings and holds using the Supabase service role client, ensuring data integrity and security.
- **Client Components** handle interactive UI (forms, date pickers, slot selection) and communicate with API routes for mutations.
- **Row-Level Security (RLS)** enforces data access at the database level — hosts can only access their own data, while guests can read public profiles and event types.
- **PostgreSQL Exclusion Constraints** provide database-level anti-double-booking guarantees, preventing overlapping confirmed bookings even under concurrent requests.

### Request Flow

1. Guest visits a public booking page → Server Component fetches host profile and event types
2. Guest selects a date → Client fetches available slots from `/api/slots`
3. Guest picks a slot → Client creates a temporary hold via `/api/holds` (5-minute TTL)
4. Guest submits booking form → Client confirms via `/api/bookings` (validates hold, inserts booking, sends emails)

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
│   │   ├── supabase/            # Supabase client utilities
│   │   ├── types/               # TypeScript type definitions
│   │   ├── utils/               # Shared utilities (slug, timezone)
│   │   └── validations/         # Zod validation schemas
│   └── middleware.ts            # Auth middleware for protected routes
├── supabase/
│   ├── migrations/              # Database migration files (001-010)
│   └── seed.sql                 # Sample data for development
├── .env.example                 # Environment variable template
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

## Key Features

- **Authentication** — Email/password sign up and login via Supabase Auth
- **Event Types** — Create multiple event types with configurable duration, buffers, and location
- **Weekly Availability** — Set recurring availability windows per weekday with timezone support
- **Date Overrides** — Mark specific dates as unavailable or set custom hours
- **Public Booking Pages** — Shareable URLs (`/username/event-slug`) for guests to book
- **Slot Holds** — 5-minute temporary holds prevent race conditions during booking
- **Anti-Double-Booking** — PostgreSQL exclusion constraints guarantee no overlapping confirmed bookings
- **Email Notifications** — Confirmation and cancellation emails to both host and guest
- **Cancellation** — Token-based cancellation links for guests; dashboard cancellation for hosts
- **Timezone Support** — Full IANA timezone handling with correct DST transitions

## License

Private — All rights reserved.
