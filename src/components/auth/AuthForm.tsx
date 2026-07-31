"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/LanguageProvider";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Feedback";
import { Checkbox, Input } from "@/components/ui/Field";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const t = useT();
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [seed, setSeed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (isSignup) {
        await api.post("/api/auth/signup", { name, email, password, seed });
      } else {
        await api.post("/api/auth/login", { email, password });
      }
      // Full navigation so server components pick up the new session cookie.
      router.push("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("auth.somethingWrong"),
      );
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <span
          className="grid size-9 place-items-center rounded-xl text-white"
          style={{ background: "var(--accent)" }}
        >
          <Sparkles className="size-[18px]" />
        </span>
        <span className="text-ink text-[15px] font-semibold tracking-tight">
          {t("nav.appName")}
        </span>
      </div>

      <h1 className="text-ink text-2xl font-semibold tracking-[-0.02em]">
        {isSignup ? t("auth.createAccount") : t("auth.welcomeBack")}
      </h1>
      <p className="text-ink-3 mt-1.5 text-sm">
        {isSignup
          ? t("auth.signupLead")
          : t("auth.loginLead")}
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        {isSignup && (
          <Input
            label={t("auth.nameLabel")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("auth.namePlaceholder")}
            autoComplete="name"
            required
          />
        )}

        <Input
          label={t("auth.emailLabel")}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <Input
          label={t("auth.passwordLabel")}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={
            isSignup ? t("auth.passwordPlaceholder") : "••••••••"
          }
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={isSignup ? 8 : undefined}
          hint={isSignup ? t("auth.passwordHint") : undefined}
          required
        />

        {isSignup && (
          <Checkbox
            checked={seed}
            onChange={setSeed}
            label={t("auth.seedLabel")}
          />
        )}

        {error && <Callout tone="danger">{error}</Callout>}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={busy}
          className="w-full"
        >
          {isSignup ? t("auth.createButton") : t("auth.signIn")}
        </Button>
      </form>

      <p className="text-ink-3 mt-6 text-center text-[13px]">
        {isSignup ? `${t("auth.haveAccount")} ` : `${t("auth.newHere")} `}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="text-accent font-medium hover:underline"
        >
          {isSignup ? t("auth.signIn") : t("auth.createAnAccount")}
        </Link>
      </p>
    </div>
  );
}
