import { json, query, withUser } from "@/lib/api";
import { all } from "@/lib/db";
import { addDays, today } from "@/lib/utils";

/**
 * Aggregates for the workout progress charts:
 *  - volume: total tonnage (sets x reps x weight) per session date
 *  - byGroup: sessions per muscle group over the window
 *  - topExercises: per-exercise heaviest set over time, for the trend lines
 */
export const GET = withUser(async (user, request) => {
  const days = Math.min(365, Math.max(14, Number(query(request).get("days")) || 90));
  const since = addDays(today(), -days);

  const volume = all<{ date: string; volume: number; exercises: number }>(
    `SELECT s.date AS date,
            COALESCE(SUM(e.sets * e.reps * e.weight), 0) AS volume,
            COUNT(e.id) AS exercises
       FROM workout_sessions s
       LEFT JOIN workout_exercises e ON e.session_id = s.id
      WHERE s.user_id = ? AND s.date >= ?
      GROUP BY s.id
      ORDER BY s.date`,
    user.id,
    since,
  );

  const byGroup = all<{ muscle_group: string; sessions: number }>(
    `SELECT muscle_group, COUNT(*) AS sessions FROM workout_sessions
      WHERE user_id = ? AND date >= ?
      GROUP BY muscle_group ORDER BY sessions DESC`,
    user.id,
    since,
  );

  const topExercises = all<{
    name: string;
    date: string;
    best_weight: number;
    volume: number;
  }>(
    `SELECT e.name AS name, s.date AS date,
            MAX(e.weight) AS best_weight,
            SUM(e.sets * e.reps * e.weight) AS volume
       FROM workout_exercises e
       JOIN workout_sessions s ON s.id = e.session_id
      WHERE e.user_id = ? AND s.date >= ?
      GROUP BY e.name, s.date
      ORDER BY e.name, s.date`,
    user.id,
    since,
  );

  const totals = all<{ sessions: number; volume: number }>(
    `SELECT COUNT(DISTINCT s.id) AS sessions,
            COALESCE(SUM(e.sets * e.reps * e.weight), 0) AS volume
       FROM workout_sessions s
       LEFT JOIN workout_exercises e ON e.session_id = s.id
      WHERE s.user_id = ? AND s.date >= ?`,
    user.id,
    since,
  )[0] ?? { sessions: 0, volume: 0 };

  return json({ days, volume, byGroup, topExercises, totals });
});
