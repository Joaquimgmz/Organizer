import type { Metadata, Viewport } from "next";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { localeOf } from "@/lib/i18n";
import { getLanguage } from "@/lib/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Routine Organizer",
    template: "%s · Routine Organizer",
  },
  description:
    "One place for your daily routine, reminders, diary, money and workouts.",
  applicationName: "Routine Organizer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read on the server so both `lang` and every label are correct in the first
  // HTML, with no post-hydration correction. Reading a cookie here makes the
  // app dynamically rendered, which it already was — every screen is behind an
  // auth cookie.
  const language = await getLanguage();

  return (
    <html lang={localeOf(language)} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <LanguageProvider initial={language}>
            <ToastProvider>{children}</ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
