"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { loginAction } from "../actions";

/** How long the logo stirs while signing in. */
const STIR_MS = 2000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string>();
  const [username, setUsername] = useState<string>();
  const [signingIn, setSigningIn] = useState(false);
  const [, start] = useTransition();

  // While signing in, <html data-signing-in> raises the logo above the blur
  // and makes it stir (see globals.css).
  useEffect(() => {
    const root = document.documentElement;
    if (signingIn) root.dataset.signingIn = "";
    else delete root.dataset.signingIn;
    return () => {
      delete root.dataset.signingIn;
    };
  }, [signingIn]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // Keep a link's "#…" part (e.g. a join request from Discord) through sign-in.
    if (next !== "/" && window.location.hash) formData.set("next", next + window.location.hash);
    setError(undefined);
    setSigningIn(true);
    start(async () => {
      // Sign in while the logo stirs; go on once both are done.
      const [result] = await Promise.all([loginAction(formData), wait(STIR_MS)]);
      if (result.next) {
        window.location.assign(result.next); // stays blurred until the next page loads
        return;
      }
      setSigningIn(false);
      setUsername(result.username);
      setError(result.error ?? "Something went wrong. Please try again.");
    });
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4" aria-busy={signingIn}>
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Email or username</span>
          <input
            name="username"
            type="text"
            key={username}
            defaultValue={username}
            autoComplete="username"
            autoCapitalize="none"
            required
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Password</span>
          <input name="password" type="password" autoComplete="current-password" required className="field" />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={signingIn} className="btn w-full">
          {signingIn ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {signingIn && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-background/55 pb-[22vh] backdrop-blur-md">
          <p role="status" className="font-serif text-lg font-bold text-foreground">
            Signing you in…
          </p>
        </div>
      )}
    </>
  );
}
