"use client";

import {
  ArrowDownToLine,
  CalendarClock,
  LineChart as LineChartIcon,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { LineChart } from "@/components/charts/Charts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/Card";
import { Callout, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, useApi } from "@/lib/client";
import { FREQUENCY_LABEL, investmentStats, monthlyEquivalent } from "@/lib/finance";
import { FREQUENCIES, type Frequency, type Investment } from "@/lib/types";
import {
  addMonths,
  formatDate,
  formatMoney,
  formatShortDate,
  relativeDay,
  titleCase,
  today,
} from "@/lib/utils";

type Draft = {
  id?: string;
  title: string;
  down_payment: string;
  contribution_amount: string;
  frequency: Frequency;
  start_date: string;
  notes: string;
};

function emptyDraft(): Draft {
  return {
    title: "",
    down_payment: "",
    contribution_amount: "",
    frequency: "monthly",
    start_date: today(),
    notes: "",
  };
}

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

/**
 * Recurring investment plans: a down payment plus a fixed amount every
 * day / week / month.
 *
 * Everything shown is money contributed, never a projected return — the app
 * has no idea what any of these actually earn, and inventing a growth rate
 * would be making up numbers about someone's money.
 */
export function InvestmentsView({ currency }: { currency: string }) {
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<{ investments: Investment[] }>(
    "/api/finance/investments",
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Investment | null>(null);
  const [saving, setSaving] = useState(false);

  const investments = data?.investments ?? [];
  const rows = investments.map((investment) => ({
    investment,
    ...investmentStats(investment),
  }));

  const totalContributed = rows.reduce((sum, row) => sum + row.contributed, 0);
  const totalDownPayments = rows.reduce(
    (sum, row) => sum + row.investment.down_payment,
    0,
  );
  const monthlyCommitment = rows.reduce((sum, row) => sum + row.perMonth, 0);

  /** Total contributed month by month, 24 months out, if the plans continue. */
  const projection = useMemo(() => {
    if (rows.length === 0) return [];
    return Array.from({ length: 25 }, (_, month) => ({
      label: formatDate(addMonths(today(), month), {
        month: "short",
        year: "2-digit",
      }),
      total: Math.round(totalContributed + monthlyCommitment * month),
    }));
  }, [rows.length, totalContributed, monthlyCommitment]);

  async function save() {
    if (!draft) return;

    if (!draft.title.trim()) {
      push("Give the investment a title.", "error");
      return;
    }
    const down = Number(draft.down_payment) || 0;
    const contribution = Number(draft.contribution_amount) || 0;
    if (down <= 0 && contribution <= 0) {
      push("Enter a down payment, a recurring amount, or both.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: draft.title,
        down_payment: down,
        contribution_amount: contribution,
        frequency: draft.frequency,
        start_date: draft.start_date,
        notes: draft.notes,
      };

      if (draft.id) {
        await api.patch(`/api/finance/investments/${draft.id}`, payload);
        push("Investment updated.");
      } else {
        await api.post("/api/finance/investments", payload);
        push("Investment added.");
      }
      setDraft(null);
      await reload();
    } catch (caught) {
      push(caught instanceof Error ? caught.message : "Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(investment: Investment) {
    try {
      await api.delete(`/api/finance/investments/${investment.id}`);
      push("Investment deleted.");
      await reload();
    } catch {
      push("Couldn't delete that investment.", "error");
    }
  }

  if (loading && !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  // Live preview of what the form's numbers mean.
  const previewMonthly =
    draft && Number(draft.contribution_amount) > 0
      ? monthlyEquivalent(Number(draft.contribution_amount), draft.frequency)
      : 0;

  return (
    <>
      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}

      {investments.length > 0 && (
        <div className="stagger mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Total put in"
            value={formatMoney(totalContributed, currency)}
            hint={`${formatMoney(totalDownPayments, currency)} of that up front`}
            icon={<TrendingUp className="size-4" />}
            accent="var(--series-1)"
          />
          <StatTile
            label="Every month"
            value={formatMoney(monthlyCommitment, currency)}
            hint="Across every plan, on one scale"
            icon={<Repeat className="size-4" />}
            accent="var(--series-3)"
          />
          <StatTile
            label="Plans running"
            value={investments.length}
            hint={
              rows.length > 0
                ? `oldest since ${formatDate(
                    [...investments].sort((a, b) =>
                      a.start_date.localeCompare(b.start_date),
                    )[0].start_date,
                    { month: "short", year: "numeric" },
                  )}`
                : undefined
            }
            icon={<LineChartIcon className="size-4" />}
            accent="var(--series-7)"
          />
          <StatTile
            label="In 12 months"
            value={formatMoney(totalContributed + monthlyCommitment * 12, currency)}
            hint="Contributions only, no returns assumed"
            icon={<CalendarClock className="size-4" />}
            accent="var(--series-6)"
          />
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setDraft(emptyDraft())}>
          <Plus className="size-4" />
          Add investment
        </Button>
      </div>

      {investments.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<TrendingUp className="size-5" />}
              title="No investments tracked"
              message="Add a plan with what you paid up front and what you put in each day, week or month."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setDraft(emptyDraft())}
                >
                  <Plus className="size-4" />
                  Add investment
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div className="stagger grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-1">
            {rows.map(
              (
                {
                  investment,
                  contributed,
                  contributionsMade,
                  perMonth,
                  nextDate,
                  projected,
                },
                index,
              ) => (
                <Card key={investment.id}>
                  <CardHeader
                    title={investment.title}
                    icon={
                      <span
                        aria-hidden
                        className="block size-2.5 rounded-[3px]"
                        style={{ background: SERIES[index % SERIES.length] }}
                      />
                    }
                    subtitle={`Started ${formatDate(investment.start_date, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}`}
                    action={
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit investment"
                          onClick={() =>
                            setDraft({
                              id: investment.id,
                              title: investment.title,
                              down_payment: String(investment.down_payment),
                              contribution_amount: String(
                                investment.contribution_amount,
                              ),
                              frequency: investment.frequency,
                              start_date: investment.start_date,
                              notes: investment.notes,
                            })
                          }
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete investment"
                          onClick={() => setDeleting(investment)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    }
                  />
                  <CardBody>
                    {/* The recurring amount lives here rather than in the header:
                        as a header action it couldn't shrink, and pushed the card
                        wider than a phone screen. */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-ink text-2xl leading-none font-semibold tracking-tight">
                          {formatMoney(contributed, currency)}
                        </p>
                        <p className="text-ink-3 mt-1 text-[12.5px]">
                          put in so far
                        </p>
                      </div>
                      {investment.contribution_amount > 0 && (
                        <Badge
                          color="var(--series-7)"
                          className="h-6 px-2 text-[12px]"
                        >
                          <Repeat className="size-3" />
                          {formatMoney(investment.contribution_amount, currency)}
                          {" / "}
                          {FREQUENCY_LABEL[investment.frequency]}
                        </Badge>
                      )}
                    </div>

                    <dl className="border-line mt-4 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-ink-3 flex items-center gap-1 text-[11.5px]">
                          <ArrowDownToLine className="size-3" />
                          Down payment
                        </dt>
                        <dd className="text-ink mt-0.5 text-[14px] font-medium tabular-nums">
                          {formatMoney(investment.down_payment, currency)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-3 text-[11.5px]">
                          Contributions made
                        </dt>
                        <dd className="text-ink mt-0.5 text-[14px] font-medium tabular-nums">
                          {contributionsMade.toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-3 text-[11.5px]">
                          Per month equivalent
                        </dt>
                        <dd className="text-ink mt-0.5 text-[14px] font-medium tabular-nums">
                          {formatMoney(perMonth, currency)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-3 text-[11.5px]">
                          Next contribution
                        </dt>
                        <dd className="text-ink mt-0.5 text-[14px] font-medium">
                          {relativeDay(nextDate)}
                        </dd>
                      </div>
                    </dl>

                    <div className="border-line mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-[12.5px]">
                      <span className="text-ink-3">
                        In a year:{" "}
                        <span className="text-ink font-medium tabular-nums">
                          {formatMoney(projected(12), currency)}
                        </span>
                      </span>
                      <span className="text-ink-3">
                        In five:{" "}
                        <span className="text-ink font-medium tabular-nums">
                          {formatMoney(projected(60), currency)}
                        </span>
                      </span>
                    </div>

                    {investment.notes && (
                      <p className="text-ink-3 mt-3 text-[12.5px] leading-relaxed">
                        {investment.notes}
                      </p>
                    )}
                  </CardBody>
                </Card>
              ),
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader
                title="Total contributed over time"
                subtitle="If you keep every plan going for the next two years"
              />
              <CardBody>
                <LineChart
                  data={projection}
                  xKey="label"
                  height={200}
                  yDomain="auto"
                  series={[
                    {
                      key: "total",
                      label: "Total contributed",
                      color: "var(--series-1)",
                    },
                  ]}
                  formatValue={(value) => formatMoney(value, currency)}
                />
                <Callout tone="info" className="mt-3">
                  This is money in, not value out. It assumes no growth and no
                  losses, because the app doesn&apos;t know what your investments
                  actually return.
                </Callout>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Monthly commitment" />
              <CardBody>
                <ul className="space-y-2">
                  {rows
                    .filter((row) => row.perMonth > 0)
                    .sort((a, b) => b.perMonth - a.perMonth)
                    .map((row, index) => (
                      <li
                        key={row.investment.id}
                        className="flex items-center gap-2 text-[12.5px]"
                      >
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-[2px]"
                          style={{ background: SERIES[index % SERIES.length] }}
                        />
                        <span className="text-ink-2 min-w-0 truncate">
                          {row.investment.title}
                        </span>
                        <span className="text-ink ml-auto shrink-0 font-medium tabular-nums">
                          {formatMoney(row.perMonth, currency)}
                        </span>
                      </li>
                    ))}
                </ul>
                <div className="border-line mt-3 flex items-center justify-between border-t pt-3 text-[13px]">
                  <span className="text-ink-2">Total</span>
                  <span className="text-ink font-semibold tabular-nums">
                    {formatMoney(monthlyCommitment, currency)}
                  </span>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* New / edit investment */}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit investment" : "Add investment"}
        description="What it is, what you paid up front, and what goes in from here."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {draft?.id ? "Save changes" : "Add investment"}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Input
              label="What is this investment?"
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              placeholder="Index fund (S&P 500)"
              autoFocus
            />

            <Input
              label={`Down payment (${currency})`}
              hint="What you put in up front"
              type="number"
              min={0}
              step="0.01"
              value={draft.down_payment}
              onChange={(event) =>
                setDraft({ ...draft, down_payment: event.target.value })
              }
              placeholder="2000"
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`Recurring amount (${currency})`}
                type="number"
                min={0}
                step="0.01"
                value={draft.contribution_amount}
                onChange={(event) =>
                  setDraft({ ...draft, contribution_amount: event.target.value })
                }
                placeholder="350"
              />
              <Select
                label="How often"
                value={draft.frequency}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    frequency: event.target.value as Frequency,
                  })
                }
              >
                {FREQUENCIES.map((frequency) => (
                  <option key={frequency} value={frequency}>
                    Every {FREQUENCY_LABEL[frequency]}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label="Start date"
              hint="When the first contribution went in"
              type="date"
              value={draft.start_date}
              onChange={(event) =>
                setDraft({ ...draft, start_date: event.target.value })
              }
            />

            <Textarea
              label="Notes"
              hint="Optional"
              rows={2}
              value={draft.notes}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
              placeholder="Where it's held, why you picked it"
            />

            {previewMonthly > 0 && (
              <Callout tone="info">
                {formatMoney(Number(draft.contribution_amount), currency)} every{" "}
                {FREQUENCY_LABEL[draft.frequency]} works out to{" "}
                <strong className="text-ink">
                  {formatMoney(previewMonthly, currency)} per month
                </strong>{" "}
                — {formatMoney(previewMonthly * 12, currency)} a year.
              </Callout>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
        title="Delete investment?"
        message={
          <>
            <strong className="text-ink">{deleting?.title}</strong> will be removed
            from your tracked plans. This doesn&apos;t affect the actual
            investment.
          </>
        }
      />
    </>
  );
}
