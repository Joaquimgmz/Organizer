"use client";

import {
  AlertTriangle,
  Bell,
  Database,
  Languages,
  Palette,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { LanguageSelect, useLanguage } from "@/components/LanguageProvider";
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
  const { t, locale } = useLanguage();
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
      push(t("settings.notificationsEnabledToast"));
      new Notification(t("nav.appName"), {
        body: t("settings.notificationsTestBody"),
      });
    } else {
      push(t("settings.notificationsDeniedToast"), "error");
    }
  }

  async function resetData(reseed: boolean) {
    setBusy(true);
    try {
      await api.post("/api/demo", { reseed });
      push(reseed ? t("settings.reseedDone") : t("settings.wipeDone"));
    } catch (caught) {
      push(
        caught instanceof Error ? caught.message : t("settings.couldntReset"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title={t("settings.title")} subtitle={t("settings.subtitle")}>
      <div className="grid max-w-3xl gap-4">
        {/* Account */}
        <Card>
          <CardHeader
            title={t("settings.account")}
            icon={<User className="size-4" />}
            subtitle={t("settings.accountSubtitle")}
          />
          <CardBody>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-ink-3 text-[12px]">{t("settings.name")}</dt>
                <dd className="text-ink mt-0.5 text-sm">{data?.user?.name ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-ink-3 text-[12px]">{t("settings.email")}</dt>
                <dd className="text-ink mt-0.5 text-sm">{data?.user?.email ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-ink-3 text-[12px]">
                  {t("settings.memberSince")}
                </dt>
                <dd className="text-ink mt-0.5 text-sm">
                  {/* Formatted with the selected language's locale, so the date
                      style matches the rest of the interface. */}
                  {data?.user?.created_at
                    ? new Date(data.user.created_at).toLocaleDateString(locale)
                    : "-"}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader
            title={t("settings.appearance")}
            icon={<Palette className="size-4" />}
            subtitle={t("settings.appearanceSubtitle")}
          />
          <CardBody>
            <ThemeToggle />
          </CardBody>
        </Card>

        {/* Language — persisted to localStorage by LanguageProvider. */}
        <Card>
          <CardHeader
            title={t("settings.language")}
            icon={<Languages className="size-4" />}
            subtitle={t("settings.languageSubtitle")}
          />
          <CardBody>
            <LanguageSelect />
          </CardBody>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader
            title={t("settings.alerts")}
            icon={<Bell className="size-4" />}
            subtitle={t("settings.alertsSubtitle")}
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
                  ? t("settings.permissionEnabled")
                  : permission === "denied"
                    ? t("settings.permissionBlocked")
                    : permission === "unsupported"
                      ? t("settings.permissionUnsupported")
                      : t("settings.permissionNotEnabled")}
              </Badge>
            }
          />
          <CardBody className="space-y-3">
            {permission === "default" && (
              <Button variant="primary" size="sm" onClick={requestNotifications}>
                <Bell className="size-3.5" />
                {t("settings.enableNotifications")}
              </Button>
            )}
            {permission === "denied" && (
              <Callout tone="warning">
                {t("settings.notificationsBlockedHelp")}
              </Callout>
            )}
            {permission === "granted" && (
              <p className="text-ink-3 text-[13px]">
                {t("settings.notificationsGrantedHelp")}
              </p>
            )}
            {permission === "unsupported" && (
              <p className="text-ink-3 text-[13px]">
                {t("settings.notificationsUnsupportedHelp")}
              </p>
            )}
          </CardBody>
        </Card>

        {/* Data */}
        <Card>
          <CardHeader
            title={t("settings.data")}
            icon={<Database className="size-4" />}
            subtitle={t("settings.dataSubtitle")}
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
                {t("settings.reloadExample")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirming("wipe")}
                loading={busy}
              >
                <Trash2 className="size-3.5" />
                {t("settings.deleteAll")}
              </Button>
            </div>
            <Callout tone="warning">
              <span className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {t("settings.dataWarning")}
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
          confirming === "reseed"
            ? t("settings.reseedTitle")
            : t("settings.wipeTitle")
        }
        message={
          confirming === "reseed"
            ? t("settings.reseedMessage")
            : t("settings.wipeMessage")
        }
        confirmLabel={
          confirming === "reseed"
            ? t("settings.reseedConfirm")
            : t("settings.wipeConfirm")
        }
      />
    </Page>
  );
}
