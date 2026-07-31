"use client";

import { LogOut, Menu, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/components/LanguageProvider";
import { ThemeToggle } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/client";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import { ReminderWatcher } from "./ReminderWatcher";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
      {NAV.map((item, index) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        // Visual break between the daily tools and the supporting sections.
        const divider = index === 5;

        return (
          <div key={item.href}>
            {divider && <div className="border-line my-2 border-t" />}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-150",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <item.icon
                className={cn(
                  "size-[17px] shrink-0 transition-transform duration-150",
                  !active && "group-hover:scale-110",
                )}
              />
              <span className="truncate">{t(item.labelKey)}</span>
              {active && (
                <span
                  aria-hidden
                  className="bg-accent absolute top-1/2 -left-2 h-4 w-0.5 -translate-y-1/2 rounded-r"
                />
              )}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

export function Shell({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [pathname]);

  async function signOut() {
    setSigningOut(true);
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-4">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-[10px] text-white shadow-sm"
        style={{ background: "var(--accent)" }}
      >
        <Sparkles className="size-4" />
      </span>
      <span className="text-ink truncate text-[14px] font-semibold tracking-tight">
        {t("nav.appName")}
      </span>
    </Link>
  );

  const account = (
    <div className="border-line border-t px-2 pt-2 pb-3">
      <div className="flex items-center gap-2.5 px-1.5 py-2">
        <span
          className="text-accent bg-accent-soft grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold"
          aria-hidden
        >
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ink truncate text-[13px] font-medium">{user.name}</p>
          <p className="text-ink-3 truncate text-[11.5px]">{user.email}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={signOut}
          loading={signingOut}
          aria-label={t("nav.signOut")}
          title={t("nav.signOut")}
        >
          {!signingOut && <LogOut className="size-4" />}
        </Button>
      </div>
      <div className="px-1.5 pt-1">
        <ThemeToggle compact />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="bg-surface border-line sticky top-0 hidden h-dvh flex-col border-r lg:flex">
        {brand}
        <NavLinks />
        {account}
      </aside>

      {/* Mobile header */}
      <header className="bg-surface/85 border-line sticky top-0 z-30 flex items-center gap-2 border-b px-3 py-2.5 backdrop-blur-md lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDrawerOpen(true)}
          aria-label={t("nav.openMenu")}
        >
          <Menu className="size-5" />
        </Button>
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-lg text-white"
            style={{ background: "var(--accent)" }}
          >
            <Sparkles className="size-3.5" />
          </span>
          <span className="text-ink truncate text-[14px] font-semibold">
            {t("nav.appName")}
          </span>
        </Link>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="animate-slide-in bg-surface border-line absolute inset-y-0 left-0 flex w-[17rem] flex-col border-r shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between pr-2">
              {brand}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDrawerOpen(false)}
                aria-label={t("nav.closeMenu")}
              >
                <X className="size-4" />
              </Button>
            </div>
            <NavLinks onNavigate={() => setDrawerOpen(false)} />
            {account}
          </div>
        </div>
      )}

      <main className="min-w-0 pb-20 lg:pb-0">{children}</main>

      {/* Mobile bottom tabs for the five daily screens */}
      <nav className="bg-surface/90 border-line fixed inset-x-0 bottom-0 z-30 flex border-t backdrop-blur-md lg:hidden">
        {NAV.filter((item) => item.primary).map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium transition-colors",
                active ? "text-accent" : "text-ink-3",
              )}
            >
              <item.icon className="size-[18px]" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <ReminderWatcher />
    </div>
  );
}

/** Standard page frame: max width, padding, title block. */
export function Page({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[86rem] px-4 py-5 sm:px-6 sm:py-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-ink text-[22px] leading-tight font-semibold tracking-[-0.02em] sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="text-ink-3 mt-1 text-[13.5px]">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </header>
      {children}
    </div>
  );
}
