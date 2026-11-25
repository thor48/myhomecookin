"use client";

import { unstable_rethrow } from "next/navigation";

/**
 * Shown when a save can't reach the server, most often because the site was
 * updated while the page was open: each release gives server actions new IDs,
 * and the old page's call isn't recognized. Without this, Next shows its blank
 * "This page couldn't load" screen.
 */
export const RELOAD_MESSAGE = "Couldn't save that. Reload the page and try again.";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Call a server action; if the call itself fails, return `{ error }` instead
 * of throwing. Redirects (after saving, or when signed out) still go through.
 */
export async function callSafely<T>(call: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await call();
  } catch (e) {
    unstable_rethrow(e);
    return { error: RELOAD_MESSAGE };
  }
}

/**
 * The same for `useActionState`: wraps an action shaped `(state, payload) =>
 * state`. `minMs` keeps it pending at least that long, so the stirring logo
 * shows for a moment even when saving is quick.
 */
export function safeFormAction<S, P>(
  action: (state: Awaited<S>, payload: P) => S | Promise<S>,
  { minMs = 0 }: { minMs?: number } = {},
) {
  return async (state: Awaited<S>, payload: P): Promise<Awaited<S>> => {
    const started = Date.now();
    try {
      return await action(state, payload);
    } catch (e) {
      unstable_rethrow(e);
      return { ...(state ?? {}), error: RELOAD_MESSAGE } as Awaited<S>;
    } finally {
      const left = minMs - (Date.now() - started);
      if (left > 0) await wait(left);
    }
  };
}
