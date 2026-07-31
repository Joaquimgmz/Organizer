"use client";

import {
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Page } from "@/components/layout/Shell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Input, Textarea } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { LineChart } from "@/components/charts/Charts";
import { api, useApi } from "@/lib/client";
import { useLanguage } from "@/components/LanguageProvider";
import { DIARY_TAGS, MOODS, type DiaryEntry } from "@/lib/types";
import { cn, formatDate, formatShortDate, relativeDay, today } from "@/lib/utils";

type Draft = {
  id?: string;
  date: string;
  title: string;
  content: string;
  mood: number;
  tags: string[];
};

function emptyDraft(): Draft {
  return { date: today(), title: "", content: "", mood: 3, tags: [] };
}

function moodOf(value: number) {
  return MOODS.find((mood) => mood.value === value) ?? MOODS[2];
}

/** Mood picker: emoji + label, so the value never rests on colour alone. */
function MoodPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const { tv } = useLanguage();
  return (
    <div className="flex gap-1.5">
      {MOODS.map((mood) => {
        const active = mood.value === value;
        // Emoji comes from MOODS; only the wording is translated.
        const label = tv("mood", String(mood.value));
        return (
          <button
            key={mood.value}
            type="button"
            onClick={() => onChange(mood.value)}
            aria-pressed={active}
            title={label}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-all duration-150",
              active
                ? "border-accent bg-accent-soft"
                : "border-line hover:border-line-strong hover:bg-surface-2",
            )}
          >
            <span className="text-lg leading-none">{mood.emoji}</span>
            <span
              className={cn(
                "text-[11px]",
                active ? "text-accent font-medium" : "text-ink-3",
              )}
            >
              {mood.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function DiaryPage() {
  const { push } = useToast();
  const { t, tv, locale } = useLanguage();
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<DiaryEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams();
  if (search.trim()) params.set("q", search.trim());
  if (tag) params.set("tag", tag);

  const { data, loading, error, reload } = useApi<{ entries: DiaryEntry[] }>(
    `/api/diary?${params}`,
  );
  const entries = data?.entries ?? [];

  // Mood trend, oldest to newest, capped to the last 30 entries.
  const moodSeries = useMemo(
    () =>
      [...entries]
        .reverse()
        .slice(-30)
        .map((entry) => ({
          date: formatShortDate(entry.date),
          mood: entry.mood,
        })),
    [entries],
  );

  const averageMood =
    entries.length > 0
      ? entries.reduce((acc, entry) => acc + entry.mood, 0) / entries.length
      : 0;

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      for (const entryTag of entry.tags) {
        counts.set(entryTag, (counts.get(entryTag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  async function save() {
    if (!draft) return;
    if (!draft.content.trim()) {
      push(t("diary.needContent"), "error");
      return;
    }

    setSaving(true);
    try {
      if (draft.id) {
        await api.patch(`/api/diary/${draft.id}`, draft);
        push(t("diary.updated"));
      } else {
        await api.post("/api/diary", draft);
        push(t("diary.saved"));
      }
      setDraft(null);
      await reload();
    } catch (caught) {
      push(
        caught instanceof Error ? caught.message : t("common.couldntSave"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: DiaryEntry) {
    try {
      await api.delete(`/api/diary/${entry.id}`);
      push(t("diary.deleted"));
      await reload();
    } catch {
      push(t("diary.couldntDelete"), "error");
    }
  }

  const hasFilters = Boolean(search.trim() || tag);

  return (
    <Page
      title={t("diary.title")}
      subtitle={
        entries.length > 0
          ? t(
              entries.length === 1 ? "diary.subtitleOne" : "diary.subtitle",
              {
                count: entries.length,
                matching: hasFilters ? t("diary.matching") : "",
                avg: averageMood.toFixed(1),
              },
            )
          : t("diary.writeAbout")
      }
      actions={
        <Button
          variant="primary"
          size="sm"
          onClick={() => setDraft(emptyDraft())}
        >
          <Plus className="size-4" />
          {t("diary.newEntry")}
        </Button>
      }
    >
      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_19rem]">
        {/* Entries */}
        <div className="min-w-0 space-y-4">
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="text-ink-3 pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("diary.searchPlaceholder")}
                  className="bg-surface border-line text-ink placeholder:text-ink-3 hover:border-line-strong focus:border-accent h-9.5 w-full rounded-lg border pr-8 pl-8.5 text-sm transition-colors outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-ink-3 hover:text-ink absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5"
                    aria-label={t("diary.clearSearch")}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {tag && (
                <Badge color="var(--accent)" className="h-8 gap-1 px-2 text-[12.5px]">
                  <TagIcon className="size-3" />
                  {tv("tag", tag)}
                  <button
                    onClick={() => setTag(null)}
                    aria-label={t("diary.clearTagFilter")}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
            </div>
          </Card>

          {loading && !data ? (
            <div className="space-y-4">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : entries.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<NotebookPen className="size-5" />}
                  title={
                    hasFilters ? t("diary.nothingMatched") : t("diary.emptyTitle")
                  }
                  message={
                    hasFilters
                      ? t("diary.tryDifferent")
                      : t("diary.emptyMessage")
                  }
                  action={
                    hasFilters ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSearch("");
                          setTag(null);
                        }}
                      >
                        {t("diary.clearFilters")}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setDraft(emptyDraft())}
                      >
                        <Plus className="size-4" />
                        {t("dash.writeEntry")}
                      </Button>
                    )
                  }
                />
              </CardBody>
            </Card>
          ) : (
            <div className="stagger space-y-3">
              {entries.map((entry) => {
                const mood = moodOf(entry.mood);
                return (
                  <Card key={entry.id} className="group p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-lg leading-none"
                            title={tv("mood", String(entry.mood))}
                          >
                            {mood.emoji}
                          </span>
                          <div className="min-w-0">
                            <p className="text-ink truncate text-sm font-medium">
                              {entry.title ||
                                relativeDay(entry.date, locale, {
                                  today: t("date.today"),
                                  tomorrow: t("date.tomorrow"),
                                  yesterday: t("date.yesterday"),
                                })}
                            </p>
                            <p className="text-ink-3 text-[12px]">
                              {t("diary.entryMeta", {
                                date: formatDate(entry.date, undefined, locale),
                                mood: tv("mood", String(entry.mood)),
                              })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("common.edit")}
                          onClick={() =>
                            setDraft({
                              id: entry.id,
                              date: entry.date,
                              title: entry.title,
                              content: entry.content,
                              mood: entry.mood,
                              tags: entry.tags,
                            })
                          }
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("common.delete")}
                          onClick={() => setDeleting(entry)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-ink-2 mt-3 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                      {entry.content}
                    </p>

                    {entry.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {entry.tags.map((entryTag) => (
                          <button key={entryTag} onClick={() => setTag(entryTag)}>
                            <Badge className="hover:bg-surface-3 transition-colors">
                              {entryTag}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Mood + tags */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={t("diary.moodOverTime")}
              subtitle={
                moodSeries.length > 1
                  ? t("diary.averageOutOf", { avg: averageMood.toFixed(1) })
                  : t("diary.needsMore")
              }
            />
            <CardBody>
              {moodSeries.length < 2 ? (
                <p className="text-ink-3 text-[13px]">
                  {t("diary.trendHint")}
                </p>
              ) : (
                <LineChart
                  data={moodSeries}
                  xKey="date"
                  height={160}
                  series={[
                    {
                      key: "mood",
                      label: t("diary.moodSeries"),
                      color: "var(--series-5)",
                    },
                  ]}
                  formatValue={(value) => `${value} / 5`}
                  formatTick={(value) => String(value)}
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t("diary.tags")}
              icon={<TagIcon className="size-4" />}
              subtitle={t("diary.tagsSubtitle")}
            />
            <CardBody>
              {tagCounts.length === 0 ? (
                <p className="text-ink-3 text-[13px]">
                  {t("diary.noTagsYet")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tagCounts.map(([name, count]) => (
                    <button
                      key={name}
                      onClick={() => setTag(tag === name ? null : name)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-[12.5px] transition-colors",
                        tag === name
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line text-ink-2 hover:border-line-strong hover:bg-surface-2",
                      )}
                    >
                      {name}
                      <span className="text-ink-3 ml-1 tabular-nums">{count}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Write / edit */}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t("diary.editEntry") : t("diary.newDiaryEntry")}
        description={
          draft ? formatDate(draft.date, undefined, locale) : undefined
        }
        size="lg"
        footer={
          <>
            {draft?.id && (
              <Button
                variant="ghost"
                className="mr-auto"
                onClick={() => {
                  const target = entries.find((entry) => entry.id === draft.id);
                  setDraft(null);
                  if (target) setDeleting(target);
                }}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {draft?.id ? t("common.saveChanges") : t("diary.saveEntry")}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[9.5rem_1fr]">
              <Input
                label={t("finance.colDate")}
                type="date"
                value={draft.date}
                onChange={(event) =>
                  setDraft({ ...draft, date: event.target.value })
                }
              />
              <Input
                label={t("rem.titleLabel")}
                hint={t("common.optional")}
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
                placeholder={t("diary.titlePlaceholder")}
              />
            </div>

            <div>
              <p className="text-ink-2 mb-1.5 text-[13px] font-medium">
                {t("diary.howWasIt")}
              </p>
              <MoodPicker
                value={draft.mood}
                onChange={(mood) => setDraft({ ...draft, mood })}
              />
            </div>

            <Textarea
              label={t("diary.contentLabel")}
              rows={9}
              value={draft.content}
              onChange={(event) =>
                setDraft({ ...draft, content: event.target.value })
              }
              placeholder={t("diary.contentPlaceholder")}
              autoFocus
            />

            <div>
              <p className="text-ink-2 mb-1.5 text-[13px] font-medium">
                Tags
                <span className="text-ink-3 ml-1.5 font-normal">
                  ({draft.tags.length} selected)
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...new Set([...DIARY_TAGS, ...draft.tags])].map((option) => {
                  const active = draft.tags.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          tags: active
                            ? draft.tags.filter((item) => item !== option)
                            : [...draft.tags, option],
                        })
                      }
                      className={cn(
                        "rounded-md border px-2 py-1 text-[12.5px] transition-colors",
                        active
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line text-ink-2 hover:border-line-strong hover:bg-surface-2",
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
        title={t("diary.deleteTitle")}
        message={
          <>
            {t("diary.deleteFrom")}{" "}
            <strong className="text-ink">
              {deleting ? formatDate(deleting.date, undefined, locale) : ""}
            </strong>{" "}
            {t("diary.deleteSuffix")}
          </>
        }
      />
    </Page>
  );
}
