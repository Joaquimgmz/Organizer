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
  return (
    <div className="flex gap-1.5">
      {MOODS.map((mood) => {
        const active = mood.value === value;
        return (
          <button
            key={mood.value}
            type="button"
            onClick={() => onChange(mood.value)}
            aria-pressed={active}
            title={mood.label}
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
      push("Write something before saving.", "error");
      return;
    }

    setSaving(true);
    try {
      if (draft.id) {
        await api.patch(`/api/diary/${draft.id}`, draft);
        push("Entry updated.");
      } else {
        await api.post("/api/diary", draft);
        push("Entry saved.");
      }
      setDraft(null);
      await reload();
    } catch (caught) {
      push(caught instanceof Error ? caught.message : "Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: DiaryEntry) {
    try {
      await api.delete(`/api/diary/${entry.id}`);
      push("Entry deleted.");
      await reload();
    } catch {
      push("Couldn't delete that entry.", "error");
    }
  }

  const hasFilters = Boolean(search.trim() || tag);

  return (
    <Page
      title="Diary"
      subtitle={
        entries.length > 0
          ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}${
              hasFilters ? " matching" : ""
            } - average mood ${averageMood.toFixed(1)}/5`
          : "Write about your day"
      }
      actions={
        <Button
          variant="primary"
          size="sm"
          onClick={() => setDraft(emptyDraft())}
        >
          <Plus className="size-4" />
          New entry
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
                  placeholder="Search everything you've written"
                  className="bg-surface border-line text-ink placeholder:text-ink-3 hover:border-line-strong focus:border-accent h-9.5 w-full rounded-lg border pr-8 pl-8.5 text-sm transition-colors outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-ink-3 hover:text-ink absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5"
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {tag && (
                <Badge color="var(--accent)" className="h-8 gap-1 px-2 text-[12.5px]">
                  <TagIcon className="size-3" />
                  {tag}
                  <button onClick={() => setTag(null)} aria-label="Clear tag filter">
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
                  title={hasFilters ? "Nothing matched" : "No entries yet"}
                  message={
                    hasFilters
                      ? "Try a different search term or clear the tag filter."
                      : "Write a few lines about today. Mood and tags make it searchable later."
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
                        Clear filters
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setDraft(emptyDraft())}
                      >
                        <Plus className="size-4" />
                        Write an entry
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
                          <span className="text-lg leading-none" title={mood.label}>
                            {mood.emoji}
                          </span>
                          <div className="min-w-0">
                            <p className="text-ink truncate text-sm font-medium">
                              {entry.title || relativeDay(entry.date)}
                            </p>
                            <p className="text-ink-3 text-[12px]">
                              {formatDate(entry.date)} - {mood.label}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit"
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
                          aria-label="Delete"
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
              title="Mood over time"
              subtitle={
                moodSeries.length > 1
                  ? `Average ${averageMood.toFixed(1)} out of 5`
                  : "Needs a couple of entries"
              }
            />
            <CardBody>
              {moodSeries.length < 2 ? (
                <p className="text-ink-3 text-[13px]">
                  Write on a few different days and the trend shows up here.
                </p>
              ) : (
                <LineChart
                  data={moodSeries}
                  xKey="date"
                  height={160}
                  series={[
                    { key: "mood", label: "Mood", color: "var(--series-5)" },
                  ]}
                  formatValue={(value) => `${value} / 5`}
                  formatTick={(value) => String(value)}
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Tags"
              icon={<TagIcon className="size-4" />}
              subtitle="Filter entries by how they felt"
            />
            <CardBody>
              {tagCounts.length === 0 ? (
                <p className="text-ink-3 text-[13px]">
                  No tags used yet. Add them when you write an entry.
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
        title={draft?.id ? "Edit entry" : "New diary entry"}
        description={draft ? formatDate(draft.date) : undefined}
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
              {draft?.id ? "Save changes" : "Save entry"}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[9.5rem_1fr]">
              <Input
                label="Date"
                type="date"
                value={draft.date}
                onChange={(event) =>
                  setDraft({ ...draft, date: event.target.value })
                }
              />
              <Input
                label="Title"
                hint="Optional"
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
                placeholder="A line that sums up the day"
              />
            </div>

            <div>
              <p className="text-ink-2 mb-1.5 text-[13px] font-medium">
                How was it?
              </p>
              <MoodPicker
                value={draft.mood}
                onChange={(mood) => setDraft({ ...draft, mood })}
              />
            </div>

            <Textarea
              label="What happened?"
              rows={9}
              value={draft.content}
              onChange={(event) =>
                setDraft({ ...draft, content: event.target.value })
              }
              placeholder="What you did, how it went, anything worth remembering."
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
        title="Delete entry?"
        message={
          <>
            The entry from{" "}
            <strong className="text-ink">
              {deleting ? formatDate(deleting.date) : ""}
            </strong>{" "}
            will be permanently deleted.
          </>
        }
      />
    </Page>
  );
}
