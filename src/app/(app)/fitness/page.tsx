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
  const status = params.get("status");
  const provider = params.get("provider");
  const detail = params.get("detail");

  useEffect(() => {
    if (!status) return;

    if (status === "connected") {
      push(`${provider === "fitbit" ? "Fitbit" : "Google Fit"} connected.`);
    } else {
      push(detail || "The connection failed.", "error");
    }

    window.history.replaceState(null, "", "/fitness");
  }, [status, provider, detail, push]);

  return null;
}

function FitnessScreen() {
  const { push } = useToast();
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
    label: formatShortDate(day.date),
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

      push("Demo data connected and synced.");
      await reload();
    } catch (caught) {
      push(
        caught instanceof Error ? caught.message : "Couldn't connect.",
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
      push("Disconnected and synced data removed.");
      await reload();
    } catch {
      push("Couldn't disconnect.", "error");
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
        push("Fitness data synced.");
      }
      await reload();
    } catch (caught) {
      push(caught instanceof Error ? caught.message : "Sync failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page
      title="Fitness data"
      subtitle={
        latest
          ? `Last synced day: ${relativeDay(latest.date)}`
          : "Connect Fitbit or Google Fit to pull in your activity"
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
            Sync now
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
          <strong className="text-ink">Demo connection.</strong> These numbers are
          generated locally so you can see the integration working. Add real client
          credentials to <code>.env.local</code> to sync actual measurements.
        </Callout>
      )}

      {/* Today's metrics */}
      {latest && (
        <div className="stagger mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Steps"
            value={latest.steps.toLocaleString()}
            hint={
              data?.averages ? `${data.averages.steps.toLocaleString()} daily avg` : undefined
            }
            icon={<Footprints className="size-4" />}
            accent="var(--series-1)"
          />
          <StatTile
            label="Calories burned"
            value={latest.calories.toLocaleString()}
            hint={
              data?.averages
                ? `${data.averages.calories.toLocaleString()} daily avg`
                : undefined
            }
            icon={<Flame className="size-4" />}
            accent="var(--series-2)"
          />
          <StatTile
            label="Active minutes"
            value={latest.active_minutes}
            hint={
              data?.averages ? `${data.averages.active_minutes} daily avg` : undefined
            }
            icon={<Timer className="size-4" />}
            accent="var(--series-3)"
          />
          <StatTile
            label="Resting heart rate"
            value={latest.resting_hr ? `${latest.resting_hr} bpm` : "Not reported"}
            hint={latest.resting_hr ? "From your tracker" : "Provider didn't send it"}
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
                  title="No tracker connected"
                  message="Connect a provider on the right to sync steps, calories, distance, active minutes, heart rate and workout sessions."
                />
              </CardBody>
            </Card>
          ) : daily.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<RefreshCw className="size-5" />}
                  title="Connected, nothing synced yet"
                  message="Run a sync to pull the last two weeks of data."
                  action={
                    <Button variant="primary" size="sm" onClick={sync} loading={busy === "sync"}>
                      Sync now
                    </Button>
                  }
                />
              </CardBody>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title="Steps"
                  subtitle="Last 14 synced days"
                  icon={<Footprints className="size-4" />}
                />
                <CardBody>
                  <ColumnChart
                    data={series}
                    xKey="label"
                    valueKey="steps"
                    seriesLabel="Steps"
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
                    title="Active minutes"
                    icon={<Timer className="size-4" />}
                  />
                  <CardBody>
                    <ColumnChart
                      data={series}
                      xKey="label"
                      valueKey="active"
                      seriesLabel="Active minutes"
                      color="var(--series-3)"
                      height={176}
                      formatValue={(value) => `${value} min`}
                      formatTick={(value) => `${value}`}
                    />
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title="Resting heart rate"
                    icon={<HeartPulse className="size-4" />}
                  />
                  <CardBody>
                    {series.every((row) => row.hr === null) ? (
                      <p className="text-ink-3 py-6 text-center text-[13px]">
                        Your provider hasn&apos;t reported resting heart rate.
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
                            label: "Resting HR",
                            color: "var(--series-8)",
                          },
                        ]}
                        formatValue={(value) => `${value} bpm`}
                        formatTick={(value) => `${value}`}
                      />
                    )}
                  </CardBody>
                </Card>
              </div>

              <Card>
                <CardHeader
                  title="Synced days"
                  subtitle="Everything pulled from your provider"
                  icon={<MapPin className="size-4" />}
                />
                <CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] border-collapse text-left">
                      <thead>
                        <tr className="border-line border-b">
                          {[
                            "Date",
                            "Steps",
                            "Calories",
                            "Distance",
                            "Active",
                            "Resting HR",
                            "Workouts",
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
                              {formatShortDate(day.date)}
                            </td>
                            <td className="text-ink-2 py-2 pr-3 text-right text-[12.5px] tabular-nums">
                              {day.steps.toLocaleString()}
                            </td>
                            <td className="text-ink-2 py-2 pr-3 text-right text-[12.5px] tabular-nums">
                              {day.calories.toLocaleString()}
                            </td>
                            <td className="text-ink-2 py-2 pr-3 text-right text-[12.5px] tabular-nums">
                              {day.distance_km.toFixed(1)} km
                            </td>
                            <td className="text-ink-2 py-2 pr-3 text-right text-[12.5px] tabular-nums">
                              {day.active_minutes} min
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
                title={provider.label}
                subtitle={provider.note}
                icon={<Activity className="size-4" />}
                action={
                  provider.connected && (
                    <Badge
                      color={provider.demo ? "var(--warning)" : "var(--good)"}
                    >
                      <CheckCircle2 className="size-3" />
                      {provider.demo ? "Demo" : "Connected"}
                    </Badge>
                  )
                }
              />
              <CardBody className="space-y-3">
                {!provider.configured && (
                  <Callout tone="info">
                    Not configured. Add{" "}
                    <code>
                      {provider.provider === "fitbit"
                        ? "FITBIT_CLIENT_ID"
                        : "GOOGLE_CLIENT_ID"}
                    </code>{" "}
                    and its secret to <code>.env.local</code>, with{" "}
                    <code>{provider.redirect_uri}</code> as the callback URL.
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
                    Disconnect
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
                      Connect with OAuth
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => connect(provider.provider, true)}
                      loading={busy === `${provider.provider}-demo`}
                    >
                      Use demo data instead
                    </Button>
                  </div>
                )}

                <p className="text-ink-3 text-[11.5px] leading-relaxed">
                  Scopes requested: <code>{provider.scope}</code>
                </p>
              </CardBody>
            </Card>
          ))}

          <Card>
            <CardHeader title="How the integration works" />
            <CardBody>
              <ol className="text-ink-2 space-y-2 text-[12.5px] leading-relaxed">
                <li>
                  <strong className="text-ink">1.</strong> You approve access on the
                  provider&apos;s own site. This app never sees your password.
                </li>
                <li>
                  <strong className="text-ink">2.</strong> The access and refresh
                  tokens are stored in your local database and refreshed
                  automatically when they expire.
                </li>
                <li>
                  <strong className="text-ink">3.</strong> Syncing pulls the last 14
                  days of daily totals. Re-syncing updates existing days rather than
                  duplicating them.
                </li>
                <li>
                  <strong className="text-ink">4.</strong> Disconnecting deletes the
                  stored tokens and the synced rows.
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
        title={`Disconnect ${disconnecting?.label ?? ""}?`}
        message="The stored tokens and every day synced from this provider will be deleted. You can reconnect at any time."
        confirmLabel="Disconnect"
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
