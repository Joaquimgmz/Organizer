# Routine Organizer

An all-in-one personal organiser: daily routine, reminders, diary, money and
workouts in one app.

Runs entirely on your machine. No cloud account needed, no services to sign up
for — the database is a single SQLite file.

---

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000>, click **Create an account**, and leave *"Start with
a month of example data"* ticked so every screen has something to show.

That's it. Nothing else needs configuring — the fitness integrations are
optional (see [Optional integrations](#optional-integrations)).

**Requires Node 22.5 or newer** (Node 24 recommended). The app uses the built-in
`node:sqlite` module, so there is no native database driver to compile.

### Production

```bash
npm run build
```

```bash
npm start
```

Set `AUTH_SECRET` before running in production — the app refuses to start
without it, so a real deployment can't accidentally ship with a development key:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Features

### Dashboard

One screen that answers "what does today look like":

- Today's timed schedule, with the current block highlighted
- Reminders due in the next 7 days, by priority
- The workout planned for today and how much of it is done
- Money: spent this month, remaining, safe-to-spend per day, top categories
- Your most recent diary entry
- A progress ring scoring the day across schedule, reminders, training, diary
  and budget, plus a logging streak

### Daily routine

- Add activities with start and end times
- Categories: school, work, study, gym, rest, food, personal, other
- **Timeline view** — an hour grid from 05:00 to midnight, with a live
  "now" marker; overlapping activities lay out side by side
- **List view** — tick things off, edit or delete
- A breakdown of where the day's hours actually went

### Diary

- Daily entries with an automatic date label
- Mood tracking, 1–5, shown with an emoji and a word (never colour alone)
- Tags — `happy`, `productive`, `stressful`, `important`, and any you invent
- Full-text search across everything you've written, plus tag filtering
- A mood trend line over your last 30 entries

### Reminders

- **Month calendar** with per-day priority dots
- **Hour-by-hour day table**, so you can see exactly where things sit and add a
  reminder at a specific hour
- Title, description, priority (low / medium / high), completion
- Repeats: daily, weekly, monthly — completion is tracked **per occurrence**, so
  ticking off today's stand-up doesn't clear tomorrow's
- Alerts when a reminder comes due: an in-app toast always, plus a desktop
  notification once you grant permission in **Settings**

### Finance

Three tabs: **Overview**, **Goals** and **Investments**.

**Overview** — the month:

- Monthly income, spending limit, savings target and currency
- Expenses with categories: food, transport, subscriptions, shopping, bills,
  entertainment, health, savings, other
- Totals for income, expenses and remaining balance
- **Planning** — what you can spend per month, per week and per day, both from
  your salary-minus-savings-target and from what's actually left this month
- **Spending pace** chart: cumulative spend against a straight line to your limit
- Spending by category, ranked

**Goals** — saving up for one expensive thing (a car, a deposit, a laptop):

- Target amount and an optional deadline
- Log each amount you put aside, with a date; the history is editable, so a
  mistyped figure can be removed
- Progress meter, percentage, and how much is still needed
- With a deadline: what you need to put aside **per month** to make it, next to
  the pace you're actually saving at — and a warning with the exact shortfall per
  month if you're behind
- Without a deadline: a projected finish date based on your observed pace

**Investments** — recurring plans:

- Title, the **down payment** you paid up front, and how much goes in every
  **day / week / month** from a start date
- Total put in to date, calculated from the contributions that have actually
  fallen due (monthly steps by calendar month, so the 31st still lands once in
  February)
- Every plan converted to a **per-month equivalent** so daily, weekly and monthly
  commitments compare on one scale
- Next contribution date, and totals in a year and in five
- A chart of total contributed over the next 24 months

> The investment figures are **money in, not value out**. Nothing assumes a
> growth rate, because the app has no idea what your investments actually return
> — inventing one would be making up numbers about your money.

### Workouts

- Choose the muscle group per day
- Exercise table: sets, reps, weight, rest time, completed — all editable inline
- **Templates** for push / pull / leg / upper body / full body days; start a
  session from one in a click, or save any session as a new template
- Full history, and progress charts: volume per session, sessions per muscle
  group, and weight progression for your most-logged lift
- **Training review** — split balance, weekly volume, whether load is actually
  progressing

### Fitness tracker integration

OAuth 2.0 connection to **Fitbit** (PKCE) and **Google Fit**, syncing steps,
calories burned, distance, active minutes, resting heart rate and workout counts.

Tokens are stored locally and refreshed automatically. Re-syncing updates
existing days rather than duplicating them, and disconnecting deletes both the
tokens and the synced rows.

Haven't registered a developer app? Use **"Use demo data instead"** to exercise
the whole flow with generated data. Demo connections are flagged in the database
and clearly labelled in the UI — they're never presented as real measurements.

### Design

- Light and dark mode, plus "match system"
- Responsive: sidebar on desktop, bottom tab bar and a drawer on mobile
- Charts, tables, progress meters and a month calendar
- Smooth, short animations that respect `prefers-reduced-motion`

---

## Optional integrations

Copy `.env.example` to `.env.local` and fill in only what you want.

| Variable | What it unlocks |
| --- | --- |
| `AUTH_SECRET` | Signs session cookies. Required in production. |
| `FITBIT_CLIENT_ID` / `FITBIT_CLIENT_SECRET` | Real Fitbit sync. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Real Google Fit sync. |
| `DATABASE_PATH` | Move the SQLite file. Defaults to `./data/routine.db`. |
| `NEXT_PUBLIC_APP_URL` | Base URL used to build OAuth redirect URIs. |

### Fitbit

1. Register an app at <https://dev.fitbit.com/apps>.
2. OAuth 2.0 Application Type: **Personal** (needed for heart-rate data).
3. Callback URL: `http://localhost:3000/api/fitness/callback/fitbit`
4. Put the client ID and secret in `.env.local` and restart the dev server.

### Google Fit

1. Create OAuth credentials at <https://console.cloud.google.com/apis/credentials>.
2. Authorised redirect URI: `http://localhost:3000/api/fitness/callback/google`
3. Enable the Fitness API for the project.

> Google is retiring the Fit REST API in favour of Health Connect, so Fitbit is
> the better-supported option today.

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript | Server components for auth-gated pages, route handlers for the API |
| Styling | Tailwind CSS v4 with CSS custom properties | Light/dark resolve in CSS from one set of design tokens |
| Database | SQLite via the built-in `node:sqlite` | Real SQL, zero native dependencies, one file to back up |
| Auth | scrypt password hashing + HMAC-signed httpOnly session cookies | No external auth service; sessions are revocable server-side |
| Charts | Hand-written SVG components | See the note below |
| Icons | `lucide-react` | |

Four runtime dependencies in total: `next`, `react`, `react-dom`, `lucide-react`.

**On charts:** this started on Recharts, which rendered bars and axis ticks
inconsistently under React 19 — empty rectangle groups after a client-side
navigation. The four forms the app needs (column, line, dual-line, ranked bars)
are about 400 lines of SVG, so they're implemented directly in
`src/components/charts/`. That removed the dependency, made rendering
deterministic, and let the marks follow the design tokens exactly.

---

## Project structure

```
src/
├── app/
│   ├── (auth)/                 Sign in / sign up (redirects away if signed in)
│   ├── (app)/                  Everything behind auth, sharing the app shell
│   │   ├── dashboard/  routine/  reminders/  diary/
│   │   └── finance/  workouts/  fitness/  settings/
│   ├── api/
│   │   ├── auth/               signup, login, logout, me
│   │   ├── activities/  diary/  reminders/
│   │   ├── finance/            settings, expenses, goals, contributions,
│   │   │                       investments
│   │   ├── workouts/           sessions, exercises, templates, progress
│   │   ├── fitness/            status, connect, callback, sync
│   │   ├── dashboard/          one aggregated read for the home screen
│   │   └── demo/               reset / reseed example data
│   ├── globals.css             Design tokens, light + dark, animations
│   └── layout.tsx
├── components/
│   ├── ui/                     Button, Card, Field, Modal, Badge, Progress,
│   │                           Toast, Feedback
│   ├── layout/                 App shell, nav, reminder watcher
│   ├── charts/                 Charts.tsx (column + line), BarList.tsx
│   ├── finance/                GoalsView, InvestmentsView
│   └── auth/                   AuthForm
└── lib/
    ├── db.ts  schema.ts        Connection + schema (applied on boot)
    ├── auth.ts  api.ts  crud.ts
    ├── types.ts  utils.ts      Shared domain types and date/money helpers
    ├── finance.ts              Goal and investment maths (no DB — client-safe)
    ├── finance-server.ts       Month-summary queries (server only)
    ├── demo.ts                 Example-data seeder
    └── fitness.ts              Fitbit + Google Fit OAuth and sync
```

---

## How a few things work

**Dates.** Stored as local-time `YYYY-MM-DD` strings so a day never shifts under
you because of a UTC conversion. All date maths goes through `src/lib/utils.ts`.

**Repeating reminders.** Stored once with a repeat rule and expanded into
occurrences for whatever range is being displayed. Completions for repeats live
in a separate `reminder_completions` table keyed by `(reminder_id, date)`.

**Goal progress.** A goal's saved amount is the sum of its dated contributions,
not a stored total. That's what makes the observed saving rate real — and it means
deleting a wrong entry corrects the progress automatically.

**Investment contributions.** Never stored per contribution; derived from the
start date, the frequency and today. So a plan is always up to date without a
scheduled job, and editing the start date recalculates the history correctly.

**Client/server split in the finance code.** `finance.ts` holds the maths and
imports no database code, because the goal and investment views are client
components — importing `node:sqlite` into a client bundle fails the build.
Queries live in `finance-server.ts`.

**Auth.** Passwords are hashed with `scrypt`. The session cookie is
`<random-id>.<hmac>`; the HMAC is checked before the id ever reaches the
database, and the id is a row in `sessions` so a session can be revoked. The
cookie is `httpOnly`, `sameSite=lax`, and `secure` in production.

**Data isolation.** Every query is scoped by `user_id`, including updates and
deletes, so one account can't read or modify another's rows — a cross-user
request gets a 404, not someone else's data.

**Fitness tokens.** Access tokens are refreshed transparently when they're within
a minute of expiring. The OAuth `state` is stored server-side with a 10-minute
window and must match the signed-in user before tokens are exchanged.

---

## Resetting data

**Settings → Data** has two options: reload the example month, or delete
everything and keep an empty account. Both clear activities, diary entries,
reminders, expenses, goals, investments and workouts. To start completely fresh,
stop the server and delete `data/routine.db`.

---

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

> Keep `typescript` on the 5.x line. TypeScript 7 (the native port) ships a
> different package layout that Next's build-time type checker can't load.
