"use client";

import { createPortal } from "react-dom";
import { AnimatedMark } from "./animated-mark";

/** How long the logo stirs at least when a recipe is added or saved. */
export const STIR_MS = 1800;

/**
 * Full-page blur with the big logo stirring in the middle, like signing in.
 * Shown while a recipe is being added or saved. Rendered into <body> so it
 * covers the header and tab bar too. People who ask their device to reduce
 * motion see the logo still.
 */
export function StirOverlay({ show, label }: { show: boolean; label: string }) {
  // Only shown after someone presses save, so the page is always in the browser by then.
  if (!show || typeof document === "undefined") return null;
  return createPortal(
    <div className="stir-overlay fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/55 px-6 backdrop-blur-md">
      <AnimatedMark variant="stacked" motion="stir" className="w-36 sm:w-44" />
      <p role="status" className="text-center font-serif text-lg font-bold text-foreground">
        {label}
      </p>
    </div>,
    document.body,
  );
}
