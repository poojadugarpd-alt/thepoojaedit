"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Couldn't sign in. Try again.");
      setBusy(false);
    }
  }

  async function onResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setResetBusy(true);
    setResetMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      // Built from the request origin, not NEXT_PUBLIC_SITE_URL — that env var
      // is unset in production today and defaults to localhost (found during
      // the admin-PWA audit); the origin the browser is actually on is always
      // correct, on any environment or future domain.
      const redirectTo = `${window.location.origin}/auth/reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo,
      });
      // Same message whether or not the address has an account — resist
      // enumeration, matching the guest-order-lookup pattern elsewhere.
      setResetMessage(
        error
          ? "Couldn't send that right now. Try again in a moment."
          : "If that email has an account, a reset link is on its way.",
      );
    } catch {
      setResetMessage("Couldn't send that right now. Try again in a moment.");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="u-page py-10 sm:py-14">
      <div className="max-w-sm">
        <p className="u-eyebrow">The Pooja Edit</p>
        <h1 className="u-h2 mt-3">Sign in</h1>
        <p className="mt-3 text-[0.95rem] text-ink">
          For store staff. Customers don&rsquo;t need an account to shop.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="u-label u-label--muted">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-[10px] border border-line bg-transparent px-3 text-base text-ink focus-visible:border-ink-strong sm:text-[0.95rem]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="u-label u-label--muted">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-[10px] border border-line bg-transparent px-3 text-base text-ink focus-visible:border-ink-strong sm:text-[0.95rem]"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-stop">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="u-pill mt-2 w-full">
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <button
            type="button"
            onClick={() => setShowReset((s) => !s)}
            className="self-start text-xs text-ink-soft underline decoration-line underline-offset-2 hover:text-ink"
          >
            Forgot password?
          </button>
        </form>

        {showReset && (
          <form
            onSubmit={onResetRequest}
            className="mt-4 flex flex-col gap-3 rounded-[10px] border border-line p-4"
          >
            <p className="text-xs text-ink-soft">
              Enter your email and we&rsquo;ll send a link to set a new password.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="u-label u-label--muted">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="h-11 rounded-[10px] border border-line bg-transparent px-3 text-base text-ink focus-visible:border-ink-strong sm:text-[0.95rem]"
              />
            </label>
            {resetMessage && (
              <p role="status" className="text-xs text-ink">
                {resetMessage}
              </p>
            )}
            <button
              type="submit"
              disabled={resetBusy}
              className="u-pill u-pill--ghost w-full"
            >
              {resetBusy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
