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
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-[10px] border border-line bg-transparent px-3 text-[0.95rem] text-ink focus-visible:border-ink-strong"
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
              className="h-11 rounded-[10px] border border-line bg-transparent px-3 text-[0.95rem] text-ink focus-visible:border-ink-strong"
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
        </form>
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
