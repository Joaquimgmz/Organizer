import { redirect } from "next/navigation";
import {
  CalendarDays,
  Dumbbell,
  NotebookPen,
  Sparkles,
  Wallet,
} from "lucide-react";
import { currentUser } from "@/lib/auth";

const HIGHLIGHTS = [
  {
    icon: CalendarDays,
    title: "Plan the day, hour by hour",
    body: "Timeline view of everything you do, with reminders on a calendar and an hourly table.",
  },
  {
    icon: Wallet,
    title: "Know where the money goes",
    body: "Income, limits, expenses by category, savings goals and recurring investments.",
  },
  {
    icon: Dumbbell,
    title: "Train with a record",
    body: "Templates for push, pull and leg days, plus weight and volume progress over time.",
  },
  {
    icon: NotebookPen,
    title: "Keep the diary honest",
    body: "Daily entries with mood tracking, tags and full-text search over everything you've written.",
  },
];

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Already signed in? Skip the form.
  if (await currentUser()) redirect("/dashboard");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Marketing panel — hidden on small screens so the form leads */}
      <aside className="bg-surface border-line relative hidden overflow-hidden border-r p-10 lg:flex lg:flex-col xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full opacity-[0.07] blur-3xl"
          style={{ background: "var(--series-1)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -bottom-28 size-[24rem] rounded-full opacity-[0.06] blur-3xl"
          style={{ background: "var(--series-3)" }}
        />

        <div className="relative flex items-center gap-2.5">
          <span
            className="grid size-9 place-items-center rounded-xl text-white shadow-sm"
            style={{ background: "var(--accent)" }}
          >
            <Sparkles className="size-[18px]" />
          </span>
          <span className="text-ink text-[15px] font-semibold tracking-tight">
            Routine Organizer
          </span>
        </div>

        <div className="relative mt-auto pt-14">
          <h1 className="text-ink max-w-lg text-[2.1rem] leading-[1.15] font-semibold tracking-[-0.02em] xl:text-[2.5rem]">
            Your whole day in one place — not five apps.
          </h1>
          <p className="text-ink-2 mt-4 max-w-md text-[15px] leading-relaxed">
            Routine, reminders, diary, savings goals, investments and training,
            all in one place.
          </p>

          <ul className="mt-10 grid max-w-xl gap-5 sm:grid-cols-2">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="text-accent bg-accent-soft mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg">
                  <item.icon className="size-4" />
                </span>
                <div>
                  <p className="text-ink text-[13.5px] font-medium">
                    {item.title}
                  </p>
                  <p className="text-ink-3 mt-0.5 text-[12.5px] leading-relaxed">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-ink-3 relative mt-auto pt-14 text-[12px]">
          Runs locally on SQLite. Your data never leaves the machine unless you
          connect a fitness provider.
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
