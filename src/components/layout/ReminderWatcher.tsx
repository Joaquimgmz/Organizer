"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client";
import type { ReminderOccurrence } from "@/lib/types";
import { formatTime, minutesOf, today } from "@/lib/utils";

const STORAGE_KEY = "ro-notified";
const POLL_MS = 60_000;
/** How long after the scheduled time we'll still surface an alert. */
const GRACE_MINUTES = 20;

function loadNotified(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      date?: string;
      keys?: string[];
    };
    // Reset at midnight so the same daily reminder alerts again tomorrow.
    if (raw.date !== today()) return new Set();
    return new Set(raw.keys ?? []);
  } catch {
    return new Set();
  }
}

function saveNotified(keys: Set<string>) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: today(), keys: [...keys] }),
    );
  } catch {
    // Private mode / storage disabled — alerts just won't dedupe across reloads.
  }
}

/**
 * Watches today's reminders and raises an alert when one comes due.
 *
 * Uses the Notification API when the user has granted permission (see
 * Settings), and always shows an in-app toast so the alert isn't lost if
 * notifications are blocked.
 */
export function ReminderWatcher() {
  const { push } = useToast();
  // `t` is memoised per language in LanguageProvider, so it is a stable dep.
  const { t } = useLanguage();
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    notified.current = loadNotified();
    let cancelled = false;

    async function check() {
      const day = today();

      let occurrences: ReminderOccurrence[] = [];
      try {
        const result = await api.get<{ occurrences: ReminderOccurrence[] }>(
          `/api/reminders?from=${day}&to=${day}`,
        );
        occurrences = result.occurrences ?? [];
      } catch {
        return; // Offline or signed out — try again next tick.
      }
      if (cancelled) return;

      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      let changed = false;

      for (const reminder of occurrences) {
        if (reminder.is_completed) continue;

        const due = minutesOf(reminder.time);
        const late = nowMinutes - due;
        if (late < 0 || late > GRACE_MINUTES) continue;

        const key = `${reminder.id}:${reminder.occurrence_date}`;
        if (notified.current.has(key)) continue;

        notified.current.add(key);
        changed = true;

        const label = t("watcher.label", {
          title: reminder.title,
          time: formatTime(reminder.time),
        });
        push(
          reminder.description
            ? t("watcher.withDescription", {
                label,
                description: reminder.description,
              })
            : label,
          reminder.priority === "high" ? "error" : "info",
        );

        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification(reminder.title, {
              body:
                reminder.description ||
                t("watcher.dueAt", { time: formatTime(reminder.time) }),
              tag: key,
              icon: "/icon.svg",
            });
          } catch {
            // Some browsers require a service worker for notifications; the
            // toast above already covered it.
          }
        }
      }

      if (changed) saveNotified(notified.current);
    }

    void check();
    const interval = setInterval(() => void check(), POLL_MS);

    // Catch up immediately when the tab comes back to the foreground.
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [push, t]);

  return null;
}
