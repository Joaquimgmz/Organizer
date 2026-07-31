import {
  Bell,
  CalendarDays,
  Dumbbell,
  HeartPulse,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Wallet,
} from "lucide-react";
import type { TranslationKey } from "@/lib/i18n";

/**
 * Navigation items. `labelKey` is a translation key rather than a literal, so
 * the sidebar and bottom tabs follow the selected language; the typed key means
 * a rename in the dictionary can't silently leave a blank label here.
 */
export const NAV = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    primary: true,
  },
  {
    href: "/routine",
    labelKey: "nav.routine",
    icon: CalendarDays,
    primary: true,
  },
  { href: "/reminders", labelKey: "nav.reminders", icon: Bell, primary: true },
  { href: "/diary", labelKey: "nav.diary", icon: NotebookPen, primary: true },
  { href: "/finance", labelKey: "nav.finance", icon: Wallet, primary: true },
  {
    href: "/workouts",
    labelKey: "nav.workouts",
    icon: Dumbbell,
    primary: false,
  },
  {
    href: "/fitness",
    labelKey: "nav.fitness",
    icon: HeartPulse,
    primary: false,
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    icon: Settings,
    primary: false,
  },
] as const satisfies readonly {
  href: string;
  labelKey: TranslationKey;
  icon: unknown;
  primary: boolean;
}[];

export type NavItem = (typeof NAV)[number];
