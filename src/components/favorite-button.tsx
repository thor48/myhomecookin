"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFavoriteAction } from "@/app/actions";
import { callSafely } from "@/lib/safe-action";

/**
 * ♥ toggle for a recipe. Updates instantly and switches back if saving fails.
 * `refresh` reloads the page's data afterwards (e.g. on My Recipes, so an
 * unfavorited recipe leaves the Favorites list).
 */
export function FavoriteButton({
  slug,
  name,
  initial,
  variant = "page",
  refresh = false,
}: {
  slug: string;
  name: string;
  initial: boolean;
  variant?: "page" | "card";
  refresh?: boolean;
}) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(initial);
  const [error, setError] = useState(false);
  const [, start] = useTransition();

  function toggle() {
    const next = !favorite;
    setFavorite(next);
    setError(false);
    start(async () => {
      const result = await callSafely(() => setFavoriteAction(slug, next));
      if (result.error) {
        setFavorite(!next);
        setError(true);
      } else if (refresh) {
        router.refresh();
      }
    });
  }

  const label = favorite ? `Remove ${name} from My Recipes` : `Save ${name} to My Recipes`;
  const heart = (
    <svg viewBox="0 0 24 24" aria-hidden className={variant === "card" ? "size-5" : "size-5"}>
      <path
        d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"
        fill={favorite ? "var(--soft-coral)" : "none"}
        stroke={favorite ? "var(--soft-coral)" : "currentColor"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={favorite}
        aria-label={label}
        title={error ? "Couldn't save. Try again." : label}
        className="grid size-9 place-items-center rounded-full bg-surface/90 text-foreground shadow-card backdrop-blur transition active:scale-90"
      >
        {heart}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={favorite}
      aria-label={label}
      className={`btn-quiet shrink-0 px-3 py-1.5 ${favorite ? "border-coral bg-coral/10" : ""}`}
    >
      {heart}
      <span>{error ? "Try again" : favorite ? "Saved" : "Save"}</span>
    </button>
  );
}
