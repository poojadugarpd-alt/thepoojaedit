"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Password-reset confirmation. Reached only via the link in the email
 * `resetPasswordForEmail` sends (see /auth/login). Supabase's browser client
 * detects the recovery token in the URL on load and fires a PASSWORD_RECOVERY
 * auth event — we wait for that (or an already-established session, in case
 * it fired before this component mounted) before showing the form, so a
 * direct visit with no valid link shows an explanation instead of a form
 * that would just fail.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecking(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't set the new password. Try the link again.");
      setBusy(false);
    }
  }

  return (
    <div className="u-page py-10 sm:py-14">
      <div className="max-w-sm">
        <p className="u-eyebrow">The Pooja Edit</p>
        <h1 className="u-h2 mt-3">Set a new password</h1>

        {checking && <p className="mt-4 text-sm text-ink-soft">Checking your link…</p>}

        {!checking && !ready && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-ink">
              This link is missing or has expired. Reset links are single-use and
              time-limited.
            </p>
            <a href="/auth/login" className="u-textlink inline-block">
              Back to sign in
            </a>
          </div>
        )}

        {ready && !done && (
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="u-label u-label--muted">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-[10px] border border-line bg-transparent px-3 text-base text-ink focus-visible:border-ink-strong sm:text-[0.95rem]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="u-label u-label--muted">Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11 rounded-[10px] border border-line bg-transparent px-3 text-base text-ink focus-visible:border-ink-strong sm:text-[0.95rem]"
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-stop">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="u-pill mt-2 w-full">
              {busy ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}

        {done && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-ok">
              Password updated. You can sign in with it now.
            </p>
            <button
              type="button"
              onClick={() => {
                router.push("/auth/login");
                router.refresh();
              }}
              className="u-pill w-full"
            >
              Go to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
