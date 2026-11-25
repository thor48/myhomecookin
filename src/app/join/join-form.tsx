"use client";

import { useActionState, useState } from "react";
import { joinAction } from "../actions";
import { safeFormAction } from "@/lib/safe-action";

const joinSafely = safeFormAction(joinAction);

export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(joinSafely, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
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
        <span className="mt-1 block text-xs text-muted">Shown on the recipes you add.</span>
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
        <span className="mt-1 block text-xs text-muted">You&apos;ll sign in with this.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-sm font-bold">
          Password
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="text-xs font-normal text-link underline"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>
        <input
          name="password"
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          autoComplete="new-password"
          className="field"
        />
        <span className="mt-1 block text-xs text-muted">At least 8 characters.</span>
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn w-full">
        {pending ? "Making your account…" : "Join the cookbook"}
      </button>
    </form>
  );
}
