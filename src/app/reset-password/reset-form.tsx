"use client";

import { useActionState, useState } from "react";
import { resetPasswordAction } from "../actions";
import { safeFormAction } from "@/lib/safe-action";

const resetSafely = safeFormAction(resetPasswordAction);

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetSafely, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          autoCapitalize="none"
          key={`e${state?.email}`}
          defaultValue={state?.email}
          className="field"
        />
        <span className="mt-1 block text-xs text-muted">The one you sign in with.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-sm font-bold">
          New password
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
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
