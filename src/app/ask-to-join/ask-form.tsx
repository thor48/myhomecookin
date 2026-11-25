"use client";

import { useActionState, useEffect, useRef } from "react";
import { askToJoinAction } from "../actions";

export function AskForm() {
  const [state, action, pending] = useActionState(askToJoinAction, undefined);
  // When the form was shown; requests sent within seconds are from bots.
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  // Added at send time, so it survives the form reset after an error.
  const submit = (formData: FormData) => {
    formData.set("t", String(startedAt.current));
    action(formData);
  };

  if (state?.sent) {
    return (
      <div className="rounded-xl bg-surface p-5 text-center shadow-card">
        <p className="font-serif text-xl font-bold">Thanks! Your request is in.</p>
        <p className="mt-2 text-muted">
          Once it&apos;s approved, you&apos;ll get an email with a link to make your account.
        </p>
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-4">
      {/* Trap for bots: hidden from people and screen readers. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Your name</span>
        <input
          name="name"
          required
          autoComplete="name"
          key={`n${state?.name}`}
          defaultValue={state?.name}
          placeholder="Jane Smith"
          className="field"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          key={`e${state?.email}`}
          defaultValue={state?.email}
          className="field"
        />
        <span className="mt-1 block text-xs text-muted">Your invite link goes here.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">How do you know us?</span>
        <textarea
          name="note"
          required
          rows={3}
          maxLength={500}
          key={`m${state?.note}`}
          defaultValue={state?.note}
          placeholder="e.g. I'm Grandma's niece, we met at the reunion last summer"
          className="field"
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn w-full">
        {pending ? "Sending…" : "Ask to join"}
      </button>
    </form>
  );
}
