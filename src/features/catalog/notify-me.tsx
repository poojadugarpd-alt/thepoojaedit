"use client";

import { useActionState, useId } from "react";

import type { CatalogType } from "@/generated/prisma";

import { notifyMeAction, type NotifyState } from "./notify-actions";

/** Takes an email instead of an order on a "Notify me" piece (D-178). */
export function NotifyMe({ catalog, slug }: { catalog: CatalogType; slug: string }) {
  const uid = useId();
  const [state, action, pending] = useActionState<NotifyState, FormData>(
    notifyMeAction.bind(null, { catalog, slug }),
    { status: "idle" },
  );

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-[10px] border border-line bg-fill p-4">
        <p className="u-label">You&rsquo;re on the list</p>
        <p className="mt-2 text-[0.95rem] text-ink">
          We&rsquo;ll email you as soon as this piece is ready to order.
        </p>
      </div>
    );
  }

  const error = state.status === "error" ? state.message : null;
  return (
    <form action={action} className="space-y-3" noValidate>
      <p className="text-[0.95rem] text-ink">
        Coming soon. Leave your email and we&rsquo;ll tell you when it&rsquo;s ready to
        order.
      </p>
      <label htmlFor={`${uid}-email`} className="sr-only">
        Email
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={`${uid}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="Your email"
          defaultValue={state.status === "error" ? state.email : ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-error` : undefined}
          className="min-w-0 flex-1 rounded-[10px] border border-line bg-transparent px-3 py-2.5 text-[0.95rem] text-ink focus-visible:border-ink-strong aria-[invalid=true]:border-stop"
        />
        <button type="submit" disabled={pending} className="u-pill justify-center">
          {pending ? "Saving…" : "Notify me"}
        </button>
      </div>
      {/* Honeypot: hidden from people; bots fill it in. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      {error && (
        <p id={`${uid}-error`} role="alert" className="text-sm text-stop">
          {error}
        </p>
      )}
    </form>
  );
}
