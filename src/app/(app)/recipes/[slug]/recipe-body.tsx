"use client";

import { useEffect, useRef, useState } from "react";
import { MarkdownBlock, MarkdownInline } from "@/lib/markdown";

type Item = { title: string | null; text: string };

/**
 * Ingredients + steps. Tap to check things off, and "Cook mode" enlarges the
 * text and keeps the phone screen awake while you cook.
 */
export function RecipeBody({ ingredients, steps }: { ingredients: Item[]; steps: Item[] }) {
  const [cooking, setCooking] = useState(false);
  const [haveIngredient, setHaveIngredient] = useState<Set<number>>(new Set());
  const [doneStep, setDoneStep] = useState<Set<number>>(new Set());
  const awake = useWakeLock(cooking);

  const toggle = (set: Set<number>, i: number) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  };

  return (
    <div className={cooking ? "text-lg sm:text-xl" : ""}>
      <div className="sticky top-[calc(env(safe-area-inset-top)+4.5rem)] z-[5] -mx-4 mt-6 flex items-center gap-3 bg-background/90 px-4 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => setCooking((c) => !c)}
          aria-pressed={cooking}
          className={cooking ? "btn py-2 text-sm" : "btn-quiet"}
        >
          {cooking ? "✓ Cook mode on" : "👩‍🍳 Cook mode"}
        </button>
        {cooking && (
          <span className="text-xs text-muted">
            {awake ? "Screen will stay on" : "Bigger text on"}
          </span>
        )}
      </div>

      <section className="mt-4">
        <h2 className="mb-3 font-serif text-2xl font-semibold">Ingredients</h2>
        <ul className="divide-y divide-border rounded-xl bg-surface shadow-card">
          {ingredients.map((ing, i) =>
            ing.title && !ing.text ? (
              <li key={i} className="px-4 pt-4 pb-2 text-sm font-semibold tracking-wide uppercase text-muted">
                {ing.title}
              </li>
            ) : (
              <li key={i}>
                {ing.title && (
                  <p className="px-4 pt-4 pb-1 text-sm font-semibold tracking-wide uppercase text-muted">
                    {ing.title}
                  </p>
                )}
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={haveIngredient.has(i)}
                    onChange={() => setHaveIngredient((s) => toggle(s, i))}
                    className="mt-1 size-5 shrink-0 accent-[var(--accent)]"
                  />
                  <span className={haveIngredient.has(i) ? "text-muted line-through" : ""}>
                    <MarkdownInline text={ing.text} />
                  </span>
                </label>
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-2xl font-semibold">Steps</h2>
        <ol className="space-y-3">
          {steps.map((step, i) => {
            const done = doneStep.has(i);
            return (
              <li key={i}>
                {step.title && <h3 className="mt-4 mb-2 font-semibold">{step.title}</h3>}
                {/* A div, not a <button>, so links inside a step stay valid and clickable. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    if ((e.target as Element).closest("a")) return;
                    setDoneStep((s) => toggle(s, i));
                  }}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                    e.preventDefault();
                    setDoneStep((s) => toggle(s, i));
                  }}
                  aria-pressed={done}
                  className={`flex w-full cursor-default gap-4 rounded-xl border p-4 text-left transition ${
                    done ? "border-border bg-transparent opacity-50" : "border-transparent bg-surface shadow-card"
                  }`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                      done ? "bg-border" : "bg-accent text-white"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <div className="min-w-0 leading-relaxed whitespace-pre-line">
                    <MarkdownBlock text={step.text} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {steps.length > 0 && (
          <p className="mt-3 text-center text-xs text-muted">Tap a step to mark it done.</p>
        )}
      </section>
    </div>
  );
}

/** Keeps the screen on while `active` (where the browser supports it). */
function useWakeLock(active: boolean) {
  const [held, setHeld] = useState(false);
  const lock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let cancelled = false;

    const request = async () => {
      try {
        lock.current = await navigator.wakeLock.request("screen");
        if (cancelled) return lock.current.release();
        setHeld(true);
        lock.current.addEventListener("release", () => setHeld(false));
      } catch {
        setHeld(false);
      }
    };
    // The lock drops when the tab is hidden; take it again on return.
    const onVisible = () => document.visibilityState === "visible" && request();

    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock.current?.release();
      lock.current = null;
    };
  }, [active]);

  return active && held;
}
