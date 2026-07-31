import { transaction } from "./db";
import { addDays, addMonths, nowIso, startOfMonth, today, uid } from "./utils";

/**
 * Seed a realistic month of example data for a new account, so every screen has
 * something to show before the user has typed anything. Called on signup and
 * from POST /api/demo.
 */
export async function seedDemoData(userId: string) {
  const t = today();
  const stamp = nowIso();

  await transaction(async ({ run }) => {
    // ── Routine: a full weekday, plus lighter days around it ────────────────
    const routine: [string, string, string, string, string][] = [
      // [dayOffset, title, category, start, end] — offset applied below
      ["0", "Morning run", "gym", "06:30", "07:15"],
      ["0", "Breakfast + planning", "food", "07:20", "08:00"],
      ["0", "Deep work block", "work", "08:30", "11:00"],
      ["0", "Lunch break", "food", "12:00", "12:45"],
      ["0", "Team sync", "work", "13:00", "13:30"],
      ["0", "Study: algorithms", "study", "14:00", "15:30"],
      ["0", "Gym — push day", "gym", "18:00", "19:15"],
      ["0", "Dinner", "food", "19:45", "20:30"],
      ["0", "Reading + wind down", "rest", "21:30", "22:30"],
      ["1", "Lectures", "school", "09:00", "12:00"],
      ["1", "Group project", "school", "14:00", "16:00"],
      ["1", "Gym — pull day", "gym", "18:00", "19:15"],
      ["-1", "Errands and groceries", "personal", "10:00", "12:00"],
      ["-1", "Rest day walk", "rest", "17:00", "18:00"],
    ];

    for (const [offset, title, category, start, end] of routine) {
      await run(
        `INSERT INTO activities (id, user_id, date, title, category, start_time, end_time, notes, completed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
        uid("a_"),
        userId,
        addDays(t, Number(offset)),
        title,
        category,
        start,
        end,
        Number(offset) < 0 ? 1 : 0,
        stamp,
      );
    }

    // ── Diary ───────────────────────────────────────────────────────────────
    const diary: [number, string, string, number, string[]][] = [
      [
        0,
        "Found my rhythm again",
        "Got up before the alarm and actually ran. The deep work block was the most focused I've been all week — no phone, door shut. Gym felt strong: bench moved up 2.5kg. Ending the day tired in the good way.",
        5,
        ["productive", "happy", "health"],
      ],
      [
        -1,
        "Slow Sunday",
        "Deliberately did very little. Groceries, a long walk, cooked properly for the first time in a while. Needed the reset after last week.",
        4,
        ["grateful", "tired"],
      ],
      [
        -3,
        "Overloaded",
        "Too many things at once — deadline moved up and I said yes to a favour I shouldn't have. Note to self: protect the morning block, it's the only time real work happens.",
        2,
        ["stressful", "important"],
      ],
      [
        -6,
        "Good conversations",
        "Long dinner with friends, talked for hours. Reminded me that the calendar being full isn't the same as the week being good.",
        4,
        ["social", "happy"],
      ],
    ];

    for (const [offset, title, content, mood, tags] of diary) {
      const date = addDays(t, offset);
      await run(
        `INSERT INTO diary_entries (id, user_id, date, title, content, mood, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        uid("d_"),
        userId,
        date,
        title,
        content,
        mood,
        JSON.stringify(tags),
        stamp,
        stamp,
      );
    }

    // ── Reminders ───────────────────────────────────────────────────────────
    const reminders: [number, string, string, string, string, string][] = [
      // [dayOffset, time, title, description, priority, repeat]
      [0, "09:00", "Stand-up meeting", "Daily team check-in", "medium", "daily"],
      [0, "13:00", "Take vitamins", "", "low", "daily"],
      [0, "17:30", "Pack gym bag", "Shaker, belt, headphones", "medium", "none"],
      [
        1,
        "10:00",
        "Submit assignment",
        "Chapter 4 problem set — upload PDF",
        "high",
        "none",
      ],
      [2, "08:00", "Dentist appointment", "Bring insurance card", "high", "none"],
      [
        3,
        "19:00",
        "Call parents",
        "",
        "medium",
        "weekly",
      ],
      [5, "12:00", "Pay rent", "Standing transfer — verify it went out", "high", "monthly"],
      [
        7,
        "15:00",
        "Review monthly budget",
        "Check subscriptions for anything unused",
        "medium",
        "monthly",
      ],
    ];

    for (const [offset, time, title, description, priority, repeat] of reminders) {
      await run(
        `INSERT INTO reminders (id, user_id, date, time, title, description, priority, repeat_rule, completed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        uid("r_"),
        userId,
        addDays(t, offset),
        time,
        title,
        description,
        priority,
        repeat,
        stamp,
      );
    }

    // ── Finance ─────────────────────────────────────────────────────────────
    await run(
      `INSERT INTO finance_settings (user_id, monthly_income, monthly_limit, savings_goal, currency)
       VALUES (?, 3200, 2400, 500, 'USD')
       ON CONFLICT(user_id) DO UPDATE SET
         monthly_income = excluded.monthly_income,
         monthly_limit  = excluded.monthly_limit,
         savings_goal   = excluded.savings_goal`,
      userId,
    );

    const monthStart = startOfMonth(t);
    const expenses: [number, string, string, number][] = [
      // [dayOfMonthOffset, description, category, amount]
      [0, "Rent", "bills", 1100],
      [0, "Phone plan", "bills", 35],
      [1, "Weekly groceries", "food", 96.4],
      [2, "Metro card top-up", "transport", 40],
      [2, "Coffee", "food", 4.5],
      [3, "Streaming bundle", "subscriptions", 17.99],
      [4, "Gym membership", "health", 45],
      [5, "Running shoes", "shopping", 128],
      [6, "Dinner out", "entertainment", 62.3],
      [7, "Weekly groceries", "food", 88.15],
      [8, "Coffee", "food", 4.5],
      [9, "Cloud storage", "subscriptions", 9.99],
      [10, "Pharmacy", "health", 23.7],
      [11, "Cinema", "entertainment", 28],
      [12, "Taxi home", "transport", 18.6],
      [13, "Weekly groceries", "food", 102.8],
      [14, "Electricity", "bills", 74.2],
      [15, "Transfer to savings", "savings", 300],
      [16, "Coffee", "food", 4.5],
      [17, "Book", "shopping", 21.5],
      [18, "Lunch with team", "food", 19.4],
      [19, "Music subscription", "subscriptions", 10.99],
      [20, "Weekly groceries", "food", 94.05],
    ];

    for (const [offset, description, category, amount] of expenses) {
      const date = addDays(monthStart, offset);
      if (date > t) continue; // don't seed spending in the future
      await run(
        `INSERT INTO expenses (id, user_id, date, description, category, amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        uid("e_"),
        userId,
        date,
        description,
        category,
        amount,
        stamp,
      );
    }

    // ── Savings goals ───────────────────────────────────────────────────────
    const goals: [string, number, number, string, [number, number][]][] = [
      // [title, target, monthsUntilTarget, notes, [[monthsAgo, amount], ...]]
      [
        "Used car",
        9500,
        14,
        "Something reliable, 5 years old or newer. Insurance quoted separately.",
        [
          [5, 800],
          [4, 450],
          [3, 450],
          [2, 600],
          [1, 450],
          [0, 450],
        ],
      ],
      [
        "Apartment deposit",
        24000,
        36,
        "20% on a one-bedroom. Keep this separate from everything else.",
        [
          [6, 2500],
          [4, 900],
          [2, 900],
          [0, 900],
        ],
      ],
      [
        "New laptop",
        2200,
        5,
        "16GB minimum. Replacing the one with the dying battery.",
        [
          [2, 300],
          [1, 300],
          [0, 250],
        ],
      ],
    ];

    for (const [title, target, monthsAhead, notes, contributions] of goals) {
      const goalId = uid("g_");
      await run(
        `INSERT INTO savings_goals (id, user_id, title, target_amount, target_date, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        goalId,
        userId,
        title,
        target,
        addMonths(t, monthsAhead),
        notes,
        stamp,
      );

      for (const [monthsAgo, amount] of contributions) {
        await run(
          `INSERT INTO goal_contributions (id, goal_id, user_id, amount, date, note, created_at)
           VALUES (?, ?, ?, ?, ?, '', ?)`,
          uid("gc_"),
          goalId,
          userId,
          amount,
          addMonths(t, -monthsAgo),
          stamp,
        );
      }
    }

    // ── Investments ─────────────────────────────────────────────────────────
    // The last element is the income history: payouts actually received, as
    // [monthsAgo, amount, note]. The spare-change fund deliberately has none,
    // so the "no income logged yet" state shows up in the example data too.
    const investments: [
      string,
      number,
      number,
      string,
      number,
      string,
      [number, number, string][],
    ][] = [
      // [title, downPayment, contribution, frequency, monthsAgoStarted, notes, income]
      [
        "Index fund (S&P 500)",
        2000,
        350,
        "monthly",
        18,
        "Automatic transfer on the 1st. Not touching this one.",
        [
          [15, 21.4, "Quarterly dividend"],
          [12, 25.8, "Quarterly dividend"],
          [9, 29.15, "Quarterly dividend"],
          [6, 33.6, "Quarterly dividend"],
          [3, 37.9, "Quarterly dividend"],
          [1, 41.25, "Quarterly dividend"],
        ],
      ],
      [
        "Retirement account",
        5000,
        400,
        "monthly",
        24,
        "Employer matches the first 3%.",
        [
          [13, 96.5, "Annual distribution"],
          [1, 114.2, "Annual distribution"],
        ],
      ],
      [
        "Spare change fund",
        50,
        5,
        "daily",
        3,
        "Rounds up card purchases. Small but it adds up.",
        [],
      ],
      [
        "Government bonds",
        1200,
        75,
        "weekly",
        7,
        "Lower return, but it's the stable part of the mix.",
        [
          [5, 18.75, "Coupon payment"],
          [2, 22.4, "Coupon payment"],
        ],
      ],
    ];

    for (const [
      title,
      downPayment,
      contribution,
      frequency,
      monthsAgo,
      notes,
      income,
    ] of investments) {
      const investmentId = uid("i_");
      await run(
        `INSERT INTO investments
           (id, user_id, title, down_payment, contribution_amount, frequency, start_date, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        investmentId,
        userId,
        title,
        downPayment,
        contribution,
        frequency,
        addMonths(t, -monthsAgo),
        notes,
        stamp,
      );

      for (const [incomeMonthsAgo, amount, note] of income) {
        await run(
          `INSERT INTO investment_income
             (id, investment_id, user_id, amount, date, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          uid("ii_"),
          investmentId,
          userId,
          amount,
          addMonths(t, -incomeMonthsAgo),
          note,
          stamp,
        );
      }
    }

    // ── Workout templates ───────────────────────────────────────────────────
    const templates: [string, string, [string, number, number, number, number][]][] =
      [
        [
          "Push day",
          "push",
          [
            ["Bench press", 4, 8, 70, 120],
            ["Incline dumbbell press", 3, 10, 24, 90],
            ["Overhead press", 3, 8, 40, 120],
            ["Cable fly", 3, 12, 15, 60],
            ["Triceps rope pushdown", 3, 12, 25, 60],
          ],
        ],
        [
          "Pull day",
          "pull",
          [
            ["Deadlift", 4, 5, 120, 180],
            ["Pull-up", 4, 8, 0, 120],
            ["Barbell row", 3, 10, 60, 90],
            ["Face pull", 3, 15, 18, 60],
            ["Barbell curl", 3, 12, 25, 60],
          ],
        ],
        [
          "Leg day",
          "legs",
          [
            ["Back squat", 4, 6, 100, 180],
            ["Romanian deadlift", 3, 10, 80, 120],
            ["Leg press", 3, 12, 140, 90],
            ["Walking lunge", 3, 12, 20, 90],
            ["Standing calf raise", 4, 15, 60, 45],
          ],
        ],
        [
          "Upper body",
          "upper body",
          [
            ["Pull-up", 3, 8, 0, 120],
            ["Bench press", 3, 8, 70, 120],
            ["Seated row", 3, 12, 55, 90],
            ["Lateral raise", 3, 15, 10, 60],
          ],
        ],
        [
          "Full body",
          "full body",
          [
            ["Back squat", 3, 8, 90, 150],
            ["Bench press", 3, 8, 65, 120],
            ["Barbell row", 3, 10, 55, 90],
            ["Plank", 3, 60, 0, 45],
          ],
        ],
      ];

    for (const [name, group, exercises] of templates) {
      await run(
        `INSERT INTO workout_templates (id, user_id, name, muscle_group, exercises, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        uid("t_"),
        userId,
        name,
        group,
        JSON.stringify(
          exercises.map(([exName, sets, reps, weight, rest]) => ({
            name: exName,
            sets,
            reps,
            weight,
            rest_seconds: rest,
          })),
        ),
        stamp,
      );
    }

    // ── Workout history: 6 sessions over the last 3 weeks, weights trending up
    const history: [number, string, string, [string, number, number, number][]][] =
      [
        [
          0,
          "Push day",
          "push",
          [
            ["Bench press", 4, 8, 72.5],
            ["Incline dumbbell press", 3, 10, 26],
            ["Overhead press", 3, 8, 42.5],
            ["Cable fly", 3, 12, 16],
            ["Triceps rope pushdown", 3, 12, 27.5],
          ],
        ],
        [
          -2,
          "Leg day",
          "legs",
          [
            ["Back squat", 4, 6, 105],
            ["Romanian deadlift", 3, 10, 85],
            ["Leg press", 3, 12, 150],
            ["Standing calf raise", 4, 15, 65],
          ],
        ],
        [
          -4,
          "Pull day",
          "pull",
          [
            ["Deadlift", 4, 5, 125],
            ["Pull-up", 4, 8, 0],
            ["Barbell row", 3, 10, 62.5],
            ["Barbell curl", 3, 12, 27.5],
          ],
        ],
        [
          -7,
          "Push day",
          "push",
          [
            ["Bench press", 4, 8, 70],
            ["Incline dumbbell press", 3, 10, 24],
            ["Overhead press", 3, 8, 40],
            ["Triceps rope pushdown", 3, 12, 25],
          ],
        ],
        [
          -9,
          "Leg day",
          "legs",
          [
            ["Back squat", 4, 6, 100],
            ["Romanian deadlift", 3, 10, 80],
            ["Leg press", 3, 12, 140],
          ],
        ],
        [
          -14,
          "Push day",
          "push",
          [
            ["Bench press", 4, 8, 67.5],
            ["Overhead press", 3, 8, 37.5],
            ["Cable fly", 3, 12, 14],
          ],
        ],
      ];

    for (const [offset, name, group, exercises] of history) {
      const sessionId = uid("w_");
      await run(
        `INSERT INTO workout_sessions (id, user_id, date, name, muscle_group, notes, created_at)
         VALUES (?, ?, ?, ?, ?, '', ?)`,
        sessionId,
        userId,
        addDays(t, offset),
        name,
        group,
        stamp,
      );

      let index = 0;
      for (const [exName, sets, reps, weight] of exercises) {
        await run(
          `INSERT INTO workout_exercises (id, session_id, user_id, name, sets, reps, weight, rest_seconds, completed, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          uid("x_"),
          sessionId,
          userId,
          exName,
          sets,
          reps,
          weight,
          90,
          offset === 0 ? (index < 2 ? 1 : 0) : 1,
          index,
        );
        index += 1;
      }
    }
  });
}

/** Wipe every row belonging to a user, keeping the account itself. */
export async function clearUserData(userId: string) {
  await transaction(async ({ run }) => {
    for (const table of [
      "activities",
      "diary_entries",
      "expenses",
      "workout_templates",
      "fitness_daily",
      // Deleted explicitly, ahead of investments, rather than left to the
      // ON DELETE CASCADE — a wipe shouldn't depend on the foreign_keys pragma
      // being on for this connection. It has its own user_id, so the order of
      // these two only matters for tidiness, not correctness.
      "investment_income",
      "investments",
    ]) {
      await run(`DELETE FROM ${table} WHERE user_id = ?`, userId);
    }
    // These cascade to reminder_completions / workout_exercises /
    // goal_contributions respectively.
    await run(`DELETE FROM reminders WHERE user_id = ?`, userId);
    await run(`DELETE FROM workout_sessions WHERE user_id = ?`, userId);
    await run(`DELETE FROM savings_goals WHERE user_id = ?`, userId);
  });
}
