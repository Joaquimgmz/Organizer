"use client";

import {
  AlertTriangle,
  Bell,
  Database,
  Palette,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { Page } from "@/components/layout/Shell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Feedback";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, useApi } from "@/lib/client";
import type { User as UserType } from "@/lib/types";

type Permission = "default" | "granted" | "denied" | "unsupported";

export default function SettingsPage() {
  const { push } = useToast();
  const { data } = useApi<{ user: UserType | null }>("/api/auth/me");

  const [permission, setPermission] = useState<Permission>("default");
  const [confirming, setConfirming] = useState<"reseed" | "wipe" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission as Permission);
    }
  }, []);

  async function requestNotifications() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result as Permission);

    if (result === "granted") {
      push("Desktop notifications enabled.");
      new Notification("Routine Organizer", {
        body: "Reminder alerts are on. You'll see them when something comes due.",
      });
    } else {
      push("Notifications were not allowed. In-app alerts still work.", "error");
    }
  }

  async function resetData(reseed: boolean) {
    setBusy(true);
    try {
      await api.post("/api/demo", { reseed });
      push(
        reseed
          ? "Data reset and example month reloaded."
          : "All your data was deleted.",
      );
    } catch (caught) {
      push(caught instanceof Error ? caught.message : "Couldn't reset.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Settings" subtitle="Account, appearance, alerts and data">
      <div className="grid max-w-3xl gap-4">
        {/* Account */}
        <Card>
          <CardHeader
            title="Account"
            icon={<User className="size-4" />}
            subtitle="Your data is tied to this account and syncs wherever you sign in"
          />
          <CardBody>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-ink-3 text-[12px]">Name</dt>
                <dd className="text-ink mt-0.5 text-sm">{data?.user?.name ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-ink-3 text-[12px]">Email</dt>
                <dd className="text-ink mt-0.5 text-sm">{data?.user?.email ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-ink-3 text-[12px]">Member since</dt>
                <dd className="text-ink mt-0.5 text-sm">
                  {data?.user?.created_at
                    ? new Date(data.user.created_at).toLocaleDateString()
                    : "-"}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader
            title="Appearance"
            icon={<Palette className="size-4" />}
            subtitle="Light, dark, or follow your operating system"
          />
          <CardBody>
            <ThemeToggle />
          </CardBody>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader
            title="Reminder alerts"
            icon={<Bell className="size-4" />}
            subtitle="In-app alerts always work. Desktop notifications need your permission."
            action={
              <Badge
                color={
                  permission === "granted"
                    ? "var(--good)"
                    : permission === "denied"
                      ? "var(--critical)"
                      : "var(--ink-3)"
                }
              >
                {permission === "granted"
                  ? "Enabled"
                  : permission === "denied"
                    ? "Blocked"
                    : permission === "unsupported"
                      ? "Unsupported"
                      : "Not enabled"}
              </Badge>
            }
          />
          <CardBody className="space-y-3">
            {permission === "default" && (
              <Button variant="primary" size="sm" onClick={requestNotifications}>
                <Bell className="size-3.5" />
                Enable desktop notifications
              </Button>
            )}
            {permission === "denied" && (
              <Callout tone="warning">
                Notifications are blocked for this site. Re-enable them in your
                browser&apos;s site settings, then reload this page.
              </Callout>
            )}
            {permission === "granted" && (
              <p className="text-ink-3 text-[13px]">
                You&apos;ll get a desktop notification when a reminder comes due,
                as long as this app is open in a tab.
              </p>
            )}
            {permission === "unsupported" && (
              <p className="text-ink-3 text-[13px]">
                This browser doesn&apos;t support notifications. In-app alerts still
                appear.
              </p>
            )}
          </CardBody>
        </Card>

        {/* Data */}
        <Card>
          <CardHeader
            title="Data"
            icon={<Database className="size-4" />}
            subtitle="Everything is stored in a local SQLite file"
          />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirming("reseed")}
                loading={busy}
              >
                <RotateCcw className="size-3.5" />
                Reload example data
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirming("wipe")}
                loading={busy}
              >
                <Trash2 className="size-3.5" />
                Delete all my data
              </Button>
            </div>
            <Callout tone="warning">
              <span className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Both options wipe your activities, diary, reminders, expenses and
                workouts first. Neither can be undone.
              </span>
            </Callout>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => resetData(confirming === "reseed")}
        title={
          confirming === "reseed" ? "Reload example data?" : "Delete all your data?"
        }
        message={
          confirming === "reseed"
            ? "Your current activities, diary entries, reminders, expenses and workouts will be deleted and replaced with the example month."
            : "Your activities, diary entries, reminders, expenses and workouts will be permanently deleted. Your account stays, but it'll be empty."
        }
        confirmLabel={confirming === "reseed" ? "Reset and reload" : "Delete everything"}
      />
    </Page>
  );
}
