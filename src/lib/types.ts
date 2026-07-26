// ── Shared domain types (used by both server routes and client components) ───

export type User = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

export const ACTIVITY_CATEGORIES = [
  "school",
  "work",
  "study",
  "gym",
  "rest",
  "food",
  "personal",
  "other",
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export type Activity = {
  id: string;
  date: string;
  title: string;
  category: ActivityCategory;
  start_time: string;
  end_time: string;
  notes: string;
  completed: number;
  created_at: string;
};

export const MOODS = [
  { value: 1, label: "Rough", emoji: "😞" },
  { value: 2, label: "Low", emoji: "🙁" },
  { value: 3, label: "Okay", emoji: "😐" },
  { value: 4, label: "Good", emoji: "🙂" },
  { value: 5, label: "Great", emoji: "😄" },
] as const;

export const DIARY_TAGS = [
  "happy",
  "productive",
  "stressful",
  "important",
  "tired",
  "grateful",
  "social",
  "health",
] as const;

export type DiaryEntry = {
  id: string;
  date: string;
  title: string;
  content: string;
  mood: number;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type Priority = "low" | "medium" | "high";
export type RepeatRule = "none" | "daily" | "weekly" | "monthly";

export type Reminder = {
  id: string;
  date: string;
  time: string;
  title: string;
  description: string;
  priority: Priority;
  repeat_rule: RepeatRule;
  completed: number;
  created_at: string;
  /** Dates (YYYY-MM-DD) on which a repeating reminder was ticked off. */
  completions?: string[];
};

/** A reminder resolved to one concrete calendar day. */
export type ReminderOccurrence = Reminder & {
  occurrence_date: string;
  is_completed: boolean;
};

export const EXPENSE_CATEGORIES = [
  "food",
  "transport",
  "subscriptions",
  "shopping",
  "bills",
  "entertainment",
  "health",
  "savings",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type Expense = {
  id: string;
  date: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  created_at: string;
};

export type FinanceSettings = {
  monthly_income: number;
  monthly_limit: number;
  savings_goal: number;
  currency: string;
};

/** How often a recurring contribution goes in. */
export const FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export type GoalContribution = {
  id: string;
  goal_id: string;
  amount: number;
  date: string;
  note: string;
  created_at: string;
};

/** Saving up for one expensive purchase. */
export type SavingsGoal = {
  id: string;
  title: string;
  target_amount: number;
  target_date: string | null;
  notes: string;
  created_at: string;
  contributions: GoalContribution[];
};

/** A recurring investment plan: down payment plus a fixed contribution. */
export type Investment = {
  id: string;
  title: string;
  down_payment: number;
  contribution_amount: number;
  frequency: Frequency;
  start_date: string;
  notes: string;
  created_at: string;
};

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
  "push",
  "pull",
  "upper body",
  "full body",
  "cardio",
  "rest",
] as const;

export type Exercise = {
  id: string;
  session_id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  rest_seconds: number;
  completed: number;
  position: number;
};

export type WorkoutSession = {
  id: string;
  date: string;
  name: string;
  muscle_group: string;
  notes: string;
  created_at: string;
  exercises: Exercise[];
};

export type TemplateExercise = {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  rest_seconds: number;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  muscle_group: string;
  exercises: TemplateExercise[];
  created_at: string;
};

export type FitnessProvider = "fitbit" | "google";

export type FitnessDay = {
  date: string;
  provider: string;
  steps: number;
  calories: number;
  distance_km: number;
  active_minutes: number;
  resting_hr: number | null;
  workout_count: number;
};

export type FitnessConnection = {
  provider: FitnessProvider;
  connected: boolean;
  demo: boolean;
  configured: boolean;
  expires_at?: string;
};

export type DashboardData = {
  date: string;
  activities: Activity[];
  reminders: ReminderOccurrence[];
  workout: WorkoutSession | null;
  diary: DiaryEntry | null;
  finance: {
    settings: FinanceSettings;
    spent_month: number;
    spent_today: number;
    remaining: number;
    daily_allowance: number;
    by_category: { category: string; total: number }[];
  };
  fitness: FitnessDay | null;
  progress: {
    activities_done: number;
    activities_total: number;
    reminders_done: number;
    reminders_total: number;
    exercises_done: number;
    exercises_total: number;
    diary_written: boolean;
    budget_ok: boolean;
    score: number;
  };
  streak: number;
};
