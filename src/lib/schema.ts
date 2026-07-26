/**
 * Database schema. Applied on every boot with CREATE TABLE IF NOT EXISTS, so it
 * doubles as the migration file for a fresh install.
 */
export const SCHEMA = /* sql */ `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ── Daily routine ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,             -- YYYY-MM-DD
  title      TEXT NOT NULL,
  category   TEXT NOT NULL,             -- school | work | study | gym | rest | food | personal | other
  start_time TEXT NOT NULL,             -- HH:MM
  end_time   TEXT NOT NULL,             -- HH:MM
  notes      TEXT NOT NULL DEFAULT '',
  completed  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, date);

-- ── Diary ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diary_entries (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL,
  mood       INTEGER NOT NULL DEFAULT 3, -- 1 (rough) .. 5 (great)
  tags       TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_diary_user_date ON diary_entries(user_id, date DESC);

-- ── Reminders ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,            -- first occurrence, YYYY-MM-DD
  time        TEXT NOT NULL,            -- HH:MM
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority    TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  repeat_rule TEXT NOT NULL DEFAULT 'none',   -- none | daily | weekly | monthly
  completed   INTEGER NOT NULL DEFAULT 0,     -- only used for repeat_rule = 'none'
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reminders_user_date ON reminders(user_id, date);

-- Per-occurrence completion for repeating reminders.
CREATE TABLE IF NOT EXISTS reminder_completions (
  reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  PRIMARY KEY (reminder_id, date)
);

-- ── Finance ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_settings (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monthly_income REAL NOT NULL DEFAULT 0,
  monthly_limit  REAL NOT NULL DEFAULT 0,
  savings_goal   REAL NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD'
);

CREATE TABLE IF NOT EXISTS expenses (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT NOT NULL,           -- food | transport | subscriptions | shopping | bills | entertainment | savings | health | other
  amount      REAL NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);

-- Saving up for one expensive purchase: a car, a deposit, a trip.
CREATE TABLE IF NOT EXISTS savings_goals (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  target_amount REAL NOT NULL,
  target_date   TEXT,                  -- optional YYYY-MM-DD deadline
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON savings_goals(user_id);

-- Money actually put aside, so progress is a history rather than one number.
CREATE TABLE IF NOT EXISTS goal_contributions (
  id         TEXT PRIMARY KEY,
  goal_id    TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     REAL NOT NULL,
  date       TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goal_contributions ON goal_contributions(goal_id, date);

-- A recurring investment plan: what was put in up front, and what goes in
-- every day / week / month from the start date onwards.
CREATE TABLE IF NOT EXISTS investments (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  down_payment        REAL NOT NULL DEFAULT 0,
  contribution_amount REAL NOT NULL DEFAULT 0,
  frequency           TEXT NOT NULL DEFAULT 'monthly', -- daily | weekly | monthly
  start_date          TEXT NOT NULL,
  notes               TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);

-- ── Workouts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  name         TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workout_sessions(user_id, date DESC);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sets         INTEGER NOT NULL DEFAULT 3,
  reps         INTEGER NOT NULL DEFAULT 10,
  weight       REAL NOT NULL DEFAULT 0,
  rest_seconds INTEGER NOT NULL DEFAULT 90,
  completed    INTEGER NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exercises_session ON workout_exercises(session_id, position);

CREATE TABLE IF NOT EXISTS workout_templates (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  exercises    TEXT NOT NULL DEFAULT '[]', -- JSON array of {name,sets,reps,weight,rest_seconds}
  created_at   TEXT NOT NULL
);

-- ── Fitness provider integration ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fitness_connections (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,          -- fitbit | google
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL DEFAULT '',
  expires_at    TEXT NOT NULL,
  scope         TEXT NOT NULL DEFAULT '',
  demo          INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS fitness_daily (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  date            TEXT NOT NULL,
  steps           INTEGER NOT NULL DEFAULT 0,
  calories        INTEGER NOT NULL DEFAULT 0,
  distance_km     REAL NOT NULL DEFAULT 0,
  active_minutes  INTEGER NOT NULL DEFAULT 0,
  resting_hr      INTEGER,
  workout_count   INTEGER NOT NULL DEFAULT 0,
  synced_at       TEXT NOT NULL,
  UNIQUE (user_id, provider, date)
);
CREATE INDEX IF NOT EXISTS idx_fitness_daily_user_date ON fitness_daily(user_id, date DESC);

-- OAuth state, so the callback can verify the round trip.
CREATE TABLE IF NOT EXISTS oauth_states (
  state         TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  code_verifier TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);
`;
