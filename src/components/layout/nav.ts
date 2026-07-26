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

export const NAV = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    primary: true,
  },
  { href: "/routine", label: "Routine", icon: CalendarDays, primary: true },
  { href: "/reminders", label: "Reminders", icon: Bell, primary: true },
  { href: "/diary", label: "Diary", icon: NotebookPen, primary: true },
  { href: "/finance", label: "Finance", icon: Wallet, primary: true },
  { href: "/workouts", label: "Workouts", icon: Dumbbell, primary: false },
  { href: "/fitness", label: "Fitness data", icon: HeartPulse, primary: false },
  { href: "/settings", label: "Settings", icon: Settings, primary: false },
] as const;

export type NavItem = (typeof NAV)[number];
