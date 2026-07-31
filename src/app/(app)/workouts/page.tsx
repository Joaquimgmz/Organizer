"use client";

import {
  BarChart3,
  Dumbbell,
  History,
  LayoutTemplate,
  Plus,
  Timer,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BarList } from "@/components/charts/BarList";
import { ColumnChart, LineChart } from "@/components/charts/Charts";
import { useLanguage } from "@/components/LanguageProvider";
import { Page } from "@/components/layout/Shell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/Card";
import { Callout, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Checkbox, Input, Segmented, Select } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Progress } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { api, useApi } from "@/lib/client";
import {
  MUSCLE_GROUPS,
  type Exercise,
  type WorkoutSession,
  type WorkoutTemplate,
} from "@/lib/types";
import {
  cn,
  formatDate,
  formatShortDate,
  relativeDay,
  today,
} from "@/lib/utils";

const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

type ProgressData = {
  volume: { date: string; volume: number; exercises: number }[];
  byGroup: { muscle_group: string; sessions: number }[];
  topExercises: { name: string; date: string; best_weight: number }[];
  totals: { sessions: number; volume: number };
};

/**
 * One row of the exercise table. Keeps its own draft state so typing stays
 * responsive, and writes to the server on blur.
 */
function ExerciseRow({
  exercise,
  onChanged,
  onDelete,
}: {
  exercise: Exercise;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const { push } = useToast();
  const { t } = useLanguage();
  const [draft, setDraft] = useState(exercise);

  useEffect(() => setDraft(exercise), [exercise]);

  async function patch(updates: Partial<Exercise>) {
    try {
      await api.patch(`/api/workouts/exercises/${exercise.id}`, updates);
      onChanged();
    } catch {
      push(t("wk.couldntSaveChange"), "error");
      setDraft(exercise);
    }
  }

  const cell =
    "bg-transparent border border-transparent hover:border-line focus:border-accent " +
    "rounded-md h-8 px-1.5 text-[13px] text-ink outline-none transition-colors tabular-nums";

  return (
    <tr
      className={cn(
        "border-line group border-b last:border-b-0",
        draft.completed === 1 && "opacity-60",
      )}
    >
      <td className="py-1.5 pr-2">
        <Checkbox
          checked={draft.completed === 1}
          onChange={(next) => {
            setDraft({ ...draft, completed: next ? 1 : 0 });
            void patch({ completed: next ? 1 : 0 });
          }}
        />
      </td>
      <td className="py-1.5 pr-2">
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          onBlur={() => draft.name !== exercise.name && patch({ name: draft.name })}
          className={cn(
            cell,
            "w-full min-w-[8rem]",
            draft.completed === 1 && "line-through",
          )}
        />
      </td>
      {(
        [
          ["sets", 1, 1],
          ["reps", 1, 1],
          ["weight", 0, 0.5],
        ] as const
      ).map(([field, min, step]) => (
        <td key={field} className="py-1.5 pr-2">
          <input
            type="number"
            min={min}
            step={step}
            value={draft[field]}
            onChange={(event) =>
              setDraft({ ...draft, [field]: Number(event.target.value) })
            }
            onBlur={() =>
              draft[field] !== exercise[field] && patch({ [field]: draft[field] })
            }
            className={cn(cell, "w-16 text-right")}
          />
        </td>
      ))}
      <td className="py-1.5 pr-2">
        <input
          type="number"
          min={0}
          step={15}
          value={draft.rest_seconds}
          onChange={(event) =>
            setDraft({ ...draft, rest_seconds: Number(event.target.value) })
          }
          onBlur={() =>
            draft.rest_seconds !== exercise.rest_seconds &&
            patch({ rest_seconds: draft.rest_seconds })
          }
          className={cn(cell, "w-16 text-right")}
        />
      </td>
      <td className="py-1.5">
        <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("wk.removeExerciseAria")}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function WorkoutsPage() {
  const { push } = useToast();
  const { t, tv, locale } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"session" | "progress">("session");
  const [creating, setCreating] = useState(false);
  const [newSession, setNewSession] = useState({
    name: "",
    muscle_group: "push",
    date: today(),
    template_id: "",
  });
  const [deletingSession, setDeletingSession] = useState<WorkoutSession | null>(
    null,
  );
  const [newExercise, setNewExercise] = useState<{
    name: string;
    sets: string;
    reps: string;
    weight: string;
    rest_seconds: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const sessionsQuery = useApi<{ sessions: WorkoutSession[] }>(
    "/api/workouts/sessions",
  );
  const templatesQuery = useApi<{ templates: WorkoutTemplate[] }>(
    "/api/workouts/templates",
  );
  const progressQuery = useApi<ProgressData>("/api/workouts/progress?days=90");

  const sessions = sessionsQuery.data?.sessions ?? [];
  const templates = templatesQuery.data?.templates ?? [];

  // Default to today's session, else the most recent one.
  const selected = useMemo(() => {
    if (selectedId) {
      const found = sessions.find((session) => session.id === selectedId);
      if (found) return found;
    }
    return sessions.find((session) => session.date === today()) ?? sessions[0] ?? null;
  }, [sessions, selectedId]);

  const volumeSeries = useMemo(
    () =>
      (progressQuery.data?.volume ?? []).map((row) => ({
        ...row,
        label: formatShortDate(row.date),
        volume: Math.round(row.volume),
      })),
    [progressQuery.data],
  );

  const groupSeries = useMemo(
    () =>
      (progressQuery.data?.byGroup ?? []).map((row, index) => ({
        ...row,
        label: tv("muscle", row.muscle_group),
        color: SERIES[index % SERIES.length],
      })),
    [progressQuery.data],
  );

  // Weight progression for the most-logged exercise.
  const trend = useMemo(() => {
    const rows = progressQuery.data?.topExercises ?? [];
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);

    const best = [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])[0];
    if (!best) return null;

    return {
      name: best[0],
      points: rows
        .filter((row) => row.name === best[0])
        .map((row) => ({
          label: formatShortDate(row.date),
          weight: row.best_weight,
        })),
    };
  }, [progressQuery.data]);

  async function createSession() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        date: newSession.date,
        muscle_group: newSession.muscle_group,
      };
      if (newSession.template_id) payload.template_id = newSession.template_id;
      if (newSession.name.trim()) payload.name = newSession.name.trim();
      if (!newSession.template_id && !newSession.name.trim()) {
        push(t("wk.needName"), "error");
        setSaving(false);
        return;
      }

      const result = await api.post<{ id: string }>(
        "/api/workouts/sessions",
        payload,
      );
      push(t("wk.created"));
      setCreating(false);
      setNewSession({ name: "", muscle_group: "push", date: today(), template_id: "" });
      await Promise.all([sessionsQuery.reload(), progressQuery.reload()]);
      setSelectedId(result.id);
      setTab("session");
    } catch (caught) {
      push(
        caught instanceof Error ? caught.message : t("wk.couldntCreate"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addExercise() {
    if (!selected || !newExercise) return;
    if (!newExercise.name.trim()) {
      push(t("wk.needExerciseName"), "error");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/api/workouts/sessions/${selected.id}/exercises`, {
        name: newExercise.name,
        sets: Number(newExercise.sets) || 3,
        reps: Number(newExercise.reps) || 10,
        weight: Number(newExercise.weight) || 0,
        rest_seconds: Number(newExercise.rest_seconds) || 90,
      });
      setNewExercise(null);
      await Promise.all([sessionsQuery.reload(), progressQuery.reload()]);
    } catch (caught) {
      push(
        caught instanceof Error ? caught.message : t("wk.couldntAdd"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeExercise(exercise: Exercise) {
    try {
      await api.delete(`/api/workouts/exercises/${exercise.id}`);
      await Promise.all([sessionsQuery.reload(), progressQuery.reload()]);
    } catch {
      push(t("wk.couldntRemoveExercise"), "error");
    }
  }

  async function removeSession(session: WorkoutSession) {
    try {
      await api.delete(`/api/workouts/sessions/${session.id}`);
      push(t("wk.deleted"));
      setSelectedId(null);
      await Promise.all([sessionsQuery.reload(), progressQuery.reload()]);
    } catch {
      push(t("wk.couldntDelete"), "error");
    }
  }

  async function saveAsTemplate(session: WorkoutSession) {
    try {
      await api.post("/api/workouts/templates", {
        name: session.name,
        muscle_group: session.muscle_group,
        exercises: session.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight,
          rest_seconds: exercise.rest_seconds,
        })),
      });
      push(t("wk.savedAsTemplate", { name: session.name }));
      await templatesQuery.reload();
    } catch (caught) {
      push(
        caught instanceof Error ? caught.message : t("wk.couldntSaveTemplate"),
        "error",
      );
    }
  }

  const doneCount = selected?.exercises.filter((e) => e.completed === 1).length ?? 0;
  const totalVolume =
    selected?.exercises.reduce(
      (acc, e) => acc + e.sets * e.reps * e.weight,
      0,
    ) ?? 0;

  const loading = sessionsQuery.loading && !sessionsQuery.data;

  return (
    <Page
      title={t("wk.title")}
      subtitle={
        progressQuery.data
          ? t("wk.subtitle", {
              sessions: progressQuery.data.totals.sessions,
              volume: Math.round(
                progressQuery.data.totals.volume,
              ).toLocaleString(locale),
            })
          : t("wk.subtitleEmpty")
      }
      actions={
        <>
          <Segmented
            value={tab}
            onChange={setTab}
            size="sm"
            options={[
              {
                value: "session",
                label: (
                  <span className="flex items-center gap-1.5">
                    <Dumbbell className="size-3.5" />
                    {t("wk.tabSession")}
                  </span>
                ),
              },
              {
                value: "progress",
                label: (
                  <span className="flex items-center gap-1.5">
                    <BarChart3 className="size-3.5" />
                    {t("wk.tabProgress")}
                  </span>
                ),
              },
            ]}
          />
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {t("wk.newWorkout")}
          </Button>
        </>
      }
    >
      {(sessionsQuery.error || progressQuery.error) && (
        <Callout tone="danger" className="mb-4">
          {sessionsQuery.error ?? progressQuery.error}
        </Callout>
      )}

      {/* Templates */}
      {templates.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                setNewSession({
                  name: template.name,
                  muscle_group: template.muscle_group,
                  date: today(),
                  template_id: template.id,
                });
                setCreating(true);
              }}
              className="bg-surface border-line hover:border-accent hover:bg-accent-soft group flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all duration-150"
            >
              <span className="bg-surface-2 text-ink-3 group-hover:text-accent grid size-8 place-items-center rounded-lg transition-colors">
                <LayoutTemplate className="size-4" />
              </span>
              <span>
                <span className="text-ink block text-[13px] font-medium">
                  {template.name}
                </span>
                <span className="text-ink-3 block text-[11.5px]">
                  {t("wk.exercisesCount", {
                    count: template.exercises.length,
                  })}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* min-w-0 stops the exercise table's min-width from escaping its
          overflow-x-auto container and scrolling the whole page sideways. */}
      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          {tab === "session" ? (
            loading ? (
              <Skeleton className="h-80" />
            ) : !selected ? (
              <Card>
                <CardBody>
                  <EmptyState
                    icon={<Dumbbell className="size-5" />}
                    title={t("wk.emptyTitle")}
                    message={t("wk.emptyMessage")}
                    action={
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setCreating(true)}
                      >
                        <Plus className="size-4" />
                        {t("wk.newWorkout")}
                      </Button>
                    }
                  />
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardHeader
                  title={selected.name}
                  icon={<Dumbbell className="size-4" />}
                  subtitle={t("wk.sessionSubtitle", {
                    date: formatDate(selected.date, undefined, locale),
                    group: tv("muscle", selected.muscle_group),
                  })}
                  action={
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => saveAsTemplate(selected)}
                        title={t("wk.saveAsTemplate")}
                      >
                        <LayoutTemplate className="size-3.5" />
                        {t("wk.saveAsTemplateBtn")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("wk.deleteWorkoutAria")}
                        onClick={() => setDeletingSession(selected)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  }
                />
                <CardBody>
                  {selected.exercises.length > 0 && (
                    <div className="mb-4 flex flex-wrap items-center gap-4">
                      <div className="min-w-[10rem] flex-1">
                        <Progress
                          value={doneCount}
                          max={selected.exercises.length}
                          color="var(--series-2)"
                          label={t("dash.exercisesCompleted")}
                        />
                        <p className="text-ink-3 mt-1.5 text-[12px]">
                          {t("wk.doneOf", {
                            done: doneCount,
                            total: selected.exercises.length,
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-ink-3 text-[11.5px]">
                          {t("wk.sessionVolume")}
                        </p>
                        <p className="text-ink text-[15px] font-semibold tabular-nums">
                          {t("wk.kg", {
                            value: Math.round(totalVolume).toLocaleString(locale),
                          })}
                        </p>
                      </div>
                    </div>
                  )}

                  {selected.exercises.length === 0 ? (
                    <EmptyState
                      icon={<Dumbbell className="size-5" />}
                      title={t("wk.noExercisesTitle")}
                      message={t("wk.noExercisesMessage")}
                      action={
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            setNewExercise({
                              name: "",
                              sets: "3",
                              reps: "10",
                              weight: "0",
                              rest_seconds: "90",
                            })
                          }
                        >
                          <Plus className="size-4" />
                          {t("wk.addExercise")}
                        </Button>
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[38rem] border-collapse text-left">
                        <thead>
                          <tr className="border-line border-b">
                            <th className="w-8 py-2" />
                            <th className="text-ink-3 py-2 pr-2 text-[11.5px] font-medium">
                              {t("wk.colExercise")}
                            </th>
                            {/* The unit is baked into each label rather than
                                appended by comparing against English text. */}
                            {[
                              { id: "sets", label: t("wk.colSets") },
                              { id: "reps", label: t("wk.colReps") },
                              { id: "weight", label: t("wk.colWeight") },
                              { id: "rest", label: t("wk.colRest") },
                            ].map((heading) => (
                              <th
                                key={heading.id}
                                className="text-ink-3 py-2 pr-2 text-right text-[11.5px] font-medium"
                              >
                                {heading.label}
                              </th>
                            ))}
                            <th className="py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {selected.exercises.map((exercise) => (
                            <ExerciseRow
                              key={exercise.id}
                              exercise={exercise}
                              onChanged={() => {
                                void sessionsQuery.reload();
                                void progressQuery.reload();
                              }}
                              onDelete={() => void removeExercise(exercise)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selected.exercises.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        setNewExercise({
                          name: "",
                          sets: "3",
                          reps: "10",
                          weight: "0",
                          rest_seconds: "90",
                        })
                      }
                    >
                      <Plus className="size-3.5" />
                      {t("wk.addExercise")}
                    </Button>
                  )}
                </CardBody>
              </Card>
            )
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatTile
                  label={t("wk.statSessions")}
                  value={progressQuery.data?.totals.sessions ?? 0}
                  hint={t("wk.last90")}
                  icon={<Dumbbell className="size-4" />}
                  accent="var(--series-2)"
                />
                <StatTile
                  label={t("wk.totalVolume")}
                  value={t("wk.kg", {
                    value: Math.round(
                      progressQuery.data?.totals.volume ?? 0,
                    ).toLocaleString(locale),
                  })}
                  hint={t("wk.volumeFormula")}
                  icon={<TrendingUp className="size-4" />}
                  accent="var(--series-1)"
                />
                <StatTile
                  label={t("wk.perWeek")}
                  value={((progressQuery.data?.totals.sessions ?? 0) / 13).toFixed(
                    1,
                  )}
                  hint={t("wk.averageSessions")}
                  icon={<Timer className="size-4" />}
                  accent="var(--series-3)"
                />
              </div>

              <Card>
                <CardHeader
                  title={t("wk.volumePerSession")}
                  subtitle={t("wk.volumePerSessionSub")}
                />
                <CardBody>
                  {volumeSeries.length === 0 ? (
                    <p className="text-ink-3 py-6 text-center text-[13px]">
                      {t("wk.volumeChartEmpty")}
                    </p>
                  ) : (
                    <ColumnChart
                      data={volumeSeries}
                      xKey="label"
                      valueKey="volume"
                      seriesLabel={t("wk.volumeSeries")}
                      height={224}
                      formatValue={(value) =>
                        t("wk.kg", { value: value.toLocaleString(locale) })
                      }
                      formatTick={(value) =>
                        value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`
                      }
                    />
                  )}
                </CardBody>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader
                    title={t("wk.byMuscleGroup")}
                    subtitle={t("wk.byMuscleGroupSub")}
                  />
                  <CardBody>
                    {groupSeries.length === 0 ? (
                      <p className="text-ink-3 text-[13px]">
                        {t("wk.nothingLogged")}
                      </p>
                    ) : (
                      <BarList
                        rows={groupSeries.map((row) => ({
                          key: row.muscle_group,
                          label: row.label,
                          value: row.sessions,
                          color: row.color,
                        }))}
                        format={(value) =>
                          value === 1
                            ? t("wk.oneSession")
                            : t("wk.sessionsCount", { count: value })
                        }
                      />
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title={
                      trend
                        ? t("wk.progressionOf", { name: trend.name })
                        : t("wk.progression")
                    }
                    subtitle={
                      trend
                        ? t("wk.heaviestSetEach")
                        : t("wk.repeatToSeeTrend")
                    }
                  />
                  <CardBody>
                    {!trend ? (
                      <p className="text-ink-3 text-[13px]">
                        {t("wk.trendEmpty")}
                      </p>
                    ) : (
                      <LineChart
                        data={trend.points}
                        xKey="label"
                        height={176}
                        yDomain="auto"
                        series={[
                          {
                            key: "weight",
                            label: t("wk.heaviestSet"),
                            color: "var(--series-2)",
                          },
                        ]}
                        formatValue={(value) => t("wk.kg", { value })}
                        formatTick={(value) => `${value}`}
                      />
                    )}
                  </CardBody>
                </Card>
              </div>
            </>
          )}
        </div>

        {/* History + AI */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title={t("wk.history")}
              icon={<History className="size-4" />}
              subtitle={t("wk.recentSessions", { count: sessions.length })}
            />
            <CardBody>
              {sessions.length === 0 ? (
                <p className="text-ink-3 text-[13px]">
                  {t("wk.noSessionsLogged")}
                </p>
              ) : (
                <ul className="max-h-[26rem] space-y-1 overflow-y-auto">
                  {sessions.map((session) => {
                    const active = session.id === selected?.id;
                    const done = session.exercises.filter(
                      (exercise) => exercise.completed === 1,
                    ).length;

                    return (
                      <li key={session.id}>
                        <button
                          onClick={() => {
                            setSelectedId(session.id);
                            setTab("session");
                          }}
                          className={cn(
                            "w-full rounded-lg px-2.5 py-2 text-left transition-colors",
                            active
                              ? "bg-accent-soft"
                              : "hover:bg-surface-2",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "truncate text-[13px] font-medium",
                                active ? "text-accent" : "text-ink",
                              )}
                            >
                              {session.name}
                            </span>
                            <span className="text-ink-3 shrink-0 text-[11.5px]">
                              {relativeDay(session.date, locale, {
                                today: t("date.today"),
                                tomorrow: t("date.tomorrow"),
                                yesterday: t("date.yesterday"),
                              })}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <Badge>{tv("muscle", session.muscle_group)}</Badge>
                            <span className="text-ink-3 text-[11.5px] tabular-nums">
                              {t("wk.doneOf", {
                                done,
                                total: session.exercises.length,
                              })}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* New workout */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t("wk.newWorkout")}
        description={t("wk.newWorkoutDesc")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={createSession} loading={saving}>
              {t("wk.createWorkout")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t("wk.templateLabel")}
            hint={t("common.optional")}
            value={newSession.template_id}
            onChange={(event) => {
              const template = templates.find(
                (item) => item.id === event.target.value,
              );
              setNewSession({
                ...newSession,
                template_id: event.target.value,
                name: template ? template.name : newSession.name,
                muscle_group: template
                  ? template.muscle_group
                  : newSession.muscle_group,
              });
            }}
          >
            <option value="">{t("wk.startFromScratch")}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {t("wk.templateOption", {
                  name: template.name,
                  count: template.exercises.length,
                })}
              </option>
            ))}
          </Select>

          <Input
            label={t("wk.workoutName")}
            value={newSession.name}
            onChange={(event) =>
              setNewSession({ ...newSession, name: event.target.value })
            }
            placeholder={t("wk.workoutNamePlaceholder")}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t("wk.muscleGroup")}
              value={newSession.muscle_group}
              onChange={(event) =>
                setNewSession({ ...newSession, muscle_group: event.target.value })
              }
            >
              {MUSCLE_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {tv("muscle", group)}
                </option>
              ))}
            </Select>
            <Input
              label={t("finance.colDate")}
              type="date"
              value={newSession.date}
              onChange={(event) =>
                setNewSession({ ...newSession, date: event.target.value })
              }
            />
          </div>
        </div>
      </Modal>

      {/* Add exercise */}
      <Modal
        open={newExercise !== null}
        onClose={() => setNewExercise(null)}
        title={t("wk.addExercise")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewExercise(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={addExercise} loading={saving}>
              {t("wk.addExercise")}
            </Button>
          </>
        }
      >
        {newExercise && (
          <div className="space-y-4">
            <Input
              label={t("wk.colExercise")}
              value={newExercise.name}
              onChange={(event) =>
                setNewExercise({ ...newExercise, name: event.target.value })
              }
              placeholder={t("wk.exerciseNamePlaceholder")}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("wk.colSets")}
                type="number"
                min={1}
                value={newExercise.sets}
                onChange={(event) =>
                  setNewExercise({ ...newExercise, sets: event.target.value })
                }
              />
              <Input
                label={t("wk.colReps")}
                type="number"
                min={1}
                value={newExercise.reps}
                onChange={(event) =>
                  setNewExercise({ ...newExercise, reps: event.target.value })
                }
              />
              <Input
                label={t("wk.colWeight")}
                type="number"
                min={0}
                step="0.5"
                value={newExercise.weight}
                onChange={(event) =>
                  setNewExercise({ ...newExercise, weight: event.target.value })
                }
              />
              <Input
                label={t("wk.restSeconds")}
                type="number"
                min={0}
                step={15}
                value={newExercise.rest_seconds}
                onChange={(event) =>
                  setNewExercise({
                    ...newExercise,
                    rest_seconds: event.target.value,
                  })
                }
              />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deletingSession !== null}
        onClose={() => setDeletingSession(null)}
        onConfirm={() => deletingSession && removeSession(deletingSession)}
        title={t("wk.deleteTitle")}
        message={
          <>
            <strong className="text-ink">{deletingSession?.name}</strong>{" "}
            {t("wk.deleteMessage")}
          </>
        }
      />
    </Page>
  );
}
