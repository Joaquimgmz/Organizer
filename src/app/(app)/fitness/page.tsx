"use client";

import {
  Activity,
  CheckCircle2,
  Flame,
  Footprints,
  HeartPulse,
  Link2,
  Link2Off,
  MapPin,
  RefreshCw,
  Timer,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ColumnChart, LineChart } from "@/components/charts/Charts";
import { Page } from "@/components/layout/Shell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/Card";
import { Callout, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, useApi } from "@/lib/client";
import type { FitnessDay, FitnessProvider } from "@/lib/types";
import { useLanguage } from "@/components/LanguageProvider";
import { formatShortDate, relativeDay } from "@/lib/utils";

type Status = {
  providers: {
    provider: FitnessProvider;
    label: string;
    note: string;
    scope: string;
    configured: boolean;
    connected: boolean;
    demo: boolean;
    expires_at: string | null;
    redirect_uri: string;
  }[];
  daily: FitnessDay[];
  latest: FitnessDay | null;
  totals: {
    steps: number;
    calories: number;
    distance_km: number;
    active_minutes: number;
  };
  averages: { steps: number; calories: number; active_minutes: number } | null;
};

/** Surfaces the ?status= result of the OAuth round trip, then cleans the URL. */
function CallbackNotice() {
  const params = useSearchParams();
  const { push } = useToast();
  const { t, tv } = useLanguage();
  const status = params.get("status");
  const provider = params.get("provider");
  const detail = params.get("detail");

  useEffect(() => {
    if (!status) return;

    if (status === "connected") {
      push(
        t("fit.connected", {
          provider: tv("provider", provider === "fitbit" ? "fitbit" : "google"),
        }),
      );
    } else {
      push(detail || t("fit.connectionFailed"), "error");
    }

    window.history.replaceState(null, "", "/fitness");
    // `t`/`tv` are memoised per language in LanguageProvider, so they are
    // stable deps rather than new identities on every render.
  }, [status, provider, detail, push, t, tv]);

  return null;
}

function FitnessScreen() {
  const { push } = useToast();
  const { t, tv, locale } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<{
    provider: FitnessProvider;
    label: string;
  } | null>(null);

  const { data, loading, error, reload } = useApi<Status>(
    "/api/fitness/status?days=14",
  );

  const providers = data?.providers ?? [];
  const daily = data?.daily ?? [];
  const latest = data?.latest ?? null;
  const anyConnected = providers.some((provider) => provider.connected);
  const usingDemo = providers.some((provider) => provider.connected && provider.demo);

  const series = daily.map((day) => ({
    label: formatShortDate(day.date, locale),
    steps: day.steps,
    calories: day.calories,
    active: day.active_minutes,
    hr: day.resting_hr,
  }));

  async function connect(provider: FitnessProvider, demo: boolean) {
    setBusy(`${provider}-${demo ? "demo" : "oauth"}`);
    try {
      const result = await api.post<{ mode: string; url?: string }>(
        `/api/fitness/connect/${provider}`,
        { demo },
      );

      if (result.mode === "oauth" && result.url) {
        // Hand off to the provider's consent screen.
        window.location.href = result.url;
        return;
      }

      push(t("fit.demoConnected"));
      await reload();
    } catch (caught) {
      push(
        caught instanceof Error ? caught.message : t("fit.couldntConnect"),
        "error",
      );
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: FitnessProvider) {
    setBusy(`${provider}-off`);
    try {
      await api.delete(`/api/fitness/connect/${provider}`);
      push(t("fit.disconnected"));
      await reload();
    } catch {
      push(t("fit.couldntDisconnect"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      const result = await api.post<{
        ok: boolean;
        results: Record<string, { synced: number } | string>;
      }>("/api/fitness/sync", { days: 14 });

      const failures = Object.entries(result.results).filter(
        ([, value]) => typeof value === "string",
      );

      if (failures.length > 0) {
        push(`${failures[0][0]}: ${failures[0][1]}`, "error");
      } else {
        push(t("fit.synced"));
      }
      await reload();
    } catch (caught) {
      push(
        caught instanceof Error ? caught.message : t("fit.syncFailed"),
        "error",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page
      title={t("dash.fitnessData")}
      subtitle={
        latest
          ? t("fit.lastSynced", {
              when: relativeDay(latest.date, locale, {
                today: t("date.today"),
                tomorrow: t("date.tomorrow"),
                yesterday: t("date.yesterday"),
              }),
            })
          : t("fit.connectPrompt")
      }
      actions={
        anyConnected && (
          <Button
            variant="secondary"
            size="sm"
            onClick={sync}
            loading={busy === "sync"}
          >
            {busy !== "sync" && <RefreshCw className="size-3.5" />}
            {t("fit.syncNow")}
          </Button>
        )
      }
    >
      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}

      {usingDemo && (
        <Callout tone="warning" className="mb-4">
          <strong className="text-ink">{t("fit.demoLead")}</strong>{" "}
          {t("fit.demoBody")}
        </Callout>
      )}

      {/* Today's metrics */}
      {latest && (
        <div className="stagger mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("dash.steps")}
            value={latest.steps.toLocaleString(locale)}
            hint={
              data?.averages
                ? t("fit.dailyAvg", {
                    value: data.averages.steps.toLocaleString(locale),
                  })
                : undefined
            }
            icon={<Footprints className="size-4" />}
            accent="var(--series-1)"
          />
          <StatTile
            label={t("fit.caloriesBurned")}
            value={latest.calories.toLocaleString(locale)}
            hint={
              data?.averages
                ? t("fit.dailyAvg", {
                    value: data.averages.calories.toLocaleString(locale),
                  })
                : undefined
            }
            icon={<Flame className="size-4" />}
            accent="var(--series-2)"
          />
          <StatTile
            label={t("fit.activeMinutes")}
            value={latest.active_minutes}
            hint={
              data?.averages
                ? t("fit.dailyAvg", { value: data.averages.active_minutes })
                : undefined
            }
            icon={<Timer className="size-4" />}
            accent="var(--series-3)"
          />
          <StatTile
            label={t("fit.restingHeartRate")}
            value={
              latest.resting_hr
                ? t("fit.bpm", { value: latest.resting_hr })
                : t("fit.notReported")
            }
            hint={
              latest.resting_hr
                ? t("fit.fromTracker")
                : t("fit.providerDidntSend")
            }
            icon={<HeartPulse className="size-4" />}
            accent="var(--series-8)"
          />
        </div>
      )}

      {/* min-w-0 keeps the synced-days table scrolling inside its own
          container rather than widening the page. */}
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-4">
          {loading && !data ? (
            <Skeleton className="h-72" />
          ) : !anyConnected ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<Activity className="size-5" />}
                  title={t("fit.noTrackerTitle")}
                  message={t("fit.noTrackerMessage")}
                />
              </CardBody>
            </Card>
          ) : daily.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<RefreshCw className="size-5" />}
                  title={t("fit.nothingSyncedTitle")}
                  message={t("fit.nothingSyncedMessage")}
                  action={
                    <Button variant="primary" size="sm" onClick={sync} loading={busy === "sync"}>
                      {t("fit.syncNow")}
                    </Button>
                  }
                />
              </CardBody>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title={t("dash.steps")}
                  subtitle={t("fit.last14")}
                  icon={<Footprints className="size-4" />}
                />
                <CardBody>
                  <ColumnChart
                    data={series}
                    xKey="label"
                    valueKey="steps"
                    seriesLabel={t("dash.steps")}
                    height={208}
                    formatTick={(value) =>
                      value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`
                    }
                  />
                </CardBody>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader
                    title={t("fit.activeMinutes")}
                    icon={<Timer className="size-4" />}
                  />
                  <CardBody>
                    <ColumnChart
                      data={series}
                      xKey="label"
                      valueKey="active"
                      seriesLabel={t("fit.activeMinutes")}
                      color="var(--series-3)"
                      height={176}
                      formatValue={(value) => t("fit.minutes", { value })}
                      formatTick={(value) => `${value}`}
                    />
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title={t("fit.restingHeartRate")}
                    icon={<HeartPulse className="size-4" />}
                  />
                  <CardBody>
                    {series.every((row) => row.hr === null) ? (
                      <p className="text-ink-3 py-6 text-center text-[13px]">
                        {t("fit.noHrReported")}
                      </p>
                    ) : (
                      <LineChart
                        data={series}
                        xKey="label"
                        height={176}
                        yDomain="auto"
                        series={[
                          {
                            key: "hr",
                            label: t("dash.restingHr"),
                            color: "var(--series-8)",
                          },
                        ]}
                        formatValue={(value) => t("fit.bpm", { value })}
                        formatTick={(value) => `${value}`}
                      />
                    )}
                  </CardBody>
                </Card>
              </div>

              <Card>
                <CardHeader
                  title={t("fit.syncedDays")}
                  subtitle={t("fit.syncedDaysSub")}
                  icon={<MapPin className="size-4" />}
                />
                <CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] border-collapse text-left">
                      <thead>
                        <tr className="border-line border-b">
                          {[
                            t("finance.colDate"),
                            t("dash.steps"),
                            t("dash.calories"),
                            t("fit.colDistance"),
                            t("fit.colActive"),
                            t("dash.restingHr"),
                            t("fit.colWorkouts"),
                          ].map((heading, index) => (
                            <th
                              key={heading}
                              className={
                                "text-ink-3 py-2 pr-3 text-[11.5px] font-medium " +
                                (index > 0 ? "text-right" : "")
                              }
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...daily].reverse().map((day) => (
                          <tr
                            key={`${day.provider}-${day.date}`}
                            className="border-line border-b last:border-b-0"
                          >
                            <td className="text-ink py-2 pr-3 text-[12.5px] whitespace-nowrap">
                              {formatShortDate(day.date, locale)}
                            </td>
                            <td className="text-ink-2 py-2 pr-3 text-right text-[12.5px] tabular-nums">
                              {day.steps.toLocaleString(locale)}
                            </td>
                            <td className="text-ink-2 py-2 pr-3 text-right text-[12.5px] tabular-nums">
                              {day.calories.toLocaleString(locale)}
                            </td>
                            <td className="text-ink-2 py-2 pr-3 text-right text-[12.5px] tabular-nums">
                              {t("fit.km", { value: day.distance_km.toFixed(1) })}
                            </td>
                            <td className="text-ink-2 py-2 pr-3 text-right text-[12.5px] tabular-nums">
                              {t("fit.minutes", { value: day.active_minutes })}
                            </td>
                            <td className="text-ink-2 py-2 pr-3 text-right text-[12.5px] tabular-nums">
                              {day.resting_hr ?? "-"}
                            </td>
                            <td className="text-ink-2 py-2 pr-3 text-right text-[12.5px] tabular-nums">
                              {day.workout_count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </>
          )}
        </div>

        {/* Providers */}
        <div className="min-w-0 space-y-4">
          {providers.map((provider) => (
            <Card key={provider.provider}>
              <CardHeader
                title={tv("provider", provider.provider)}
                subtitle={t(`providerNote.${provider.provider}`)}
                icon={<Activity className="size-4" />}
                action={
                  provider.connected && (
                    <Badge
                      color={provider.demo ? "var(--warning)" : "var(--good)"}
                    >
                      <CheckCircle2 className="size-3" />
                      {provider.demo
                        ? t("fit.badgeDemo")
                        : t("fit.badgeConnected")}
                    </Badge>
                  )
                }
              />
              <CardBody className="space-y-3">
                {!provider.configured && (
                  <Callout tone="info">
                    {t("fit.notConfigured")}{" "}
                    <code>
                      {provider.provider === "fitbit"
                        ? "FITBIT_CLIENT_ID"
                        : "GOOGLE_CLIENT_ID"}
                    </code>{" "}
                    {t("fit.andSecretTo")} <code>.env.local</code>,{" "}
                    {t("fit.withText")} <code>{provider.redirect_uri}</code>{" "}
                    {t("fit.asCallback")}
                  </Callout>
                )}

                {provider.connected ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      setDisconnecting({
                        provider: provider.provider,
                        label: provider.label,
                      })
                    }
                    loading={busy === `${provider.provider}-off`}
                  >
                    <Link2Off className="size-3.5" />
                    {t("fit.disconnect")}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      disabled={!provider.configured}
                      onClick={() => connect(provider.provider, false)}
                      loading={busy === `${provider.provider}-oauth`}
                    >
                      <Link2 className="size-3.5" />
                      {t("fit.connectOAuth")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => connect(provider.provider, true)}
                      loading={busy === `${provider.provider}-demo`}
                    >
                      {t("fit.useDemoInstead")}
                    </Button>
                  </div>
                )}

                <p className="text-ink-3 text-[11.5px] leading-relaxed">
                  {t("fit.scopesRequested")} <code>{provider.scope}</code>
                </p>
              </CardBody>
            </Card>
          ))}

          <Card>
            <CardHeader title={t("fit.howItWorks")} />
            <CardBody>
              <ol className="text-ink-2 space-y-2 text-[12.5px] leading-relaxed">
                <li>
                  <strong className="text-ink">1.</strong> {t("fit.step1")}
                </li>
                <li>
                  <strong className="text-ink">2.</strong> {t("fit.step2")}
                </li>
                <li>
                  <strong className="text-ink">3.</strong> {t("fit.step3")}
                </li>
                <li>
                  <strong className="text-ink">4.</strong> {t("fit.step4")}
                </li>
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={disconnecting !== null}
        onClose={() => setDisconnecting(null)}
        onConfirm={() => disconnecting && disconnect(disconnecting.provider)}
        title={t("fit.disconnectTitle", {
          provider: disconnecting?.label ?? "",
        })}
        message={t("fit.disconnectMessage")}
        confirmLabel={t("fit.disconnect")}
      />
    </Page>
  );
}

export default function FitnessPage() {
  return (
    <>
      <Suspense fallback={null}>
        <CallbackNotice />
      </Suspense>
      <FitnessScreen />
    </>
  );
}
