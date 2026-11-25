"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Chrome / Edge / Samsung Internet's install prompt (not in TypeScript's DOM types). */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __installPrompt?: InstallPromptEvent | null;
  }
  interface Navigator {
    standalone?: boolean; // iOS Safari, when opened from the Home Screen
  }
}

/**
 * Registers the service worker (public/sw.js) and tells it which page is
 * open, so it keeps a copy for when there's no connection.
 * Production only: in `next dev` a service worker would get in the way of
 * hot reloading, so any old one is removed instead.
 */
export function ServiceWorker() {
  const path = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "keep-page", path }));
  }, [path]);

  return null;
}

type Mode = "prompt" | "ios" | "android";

function detectMode(): Mode | null {
  const installed = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (installed) return null;
  if (window.__installPrompt) return "prompt";
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null; // a computer with no install option: nothing to show
}

/**
 * Footer button that puts the cookbook on the Home Screen.
 * - Android (Chrome, Edge, Samsung Internet) and desktop Chrome/Edge: opens the browser's own install prompt.
 * - iPhone / iPad: Safari doesn't let sites do that, so it shows the steps (Share → Add to Home Screen).
 * - Android browsers without a prompt (e.g. Firefox): shows the menu steps.
 * Hidden once the app is installed and opened from the Home Screen.
 */
export function InstallButton() {
  const [mode, setMode] = useState<Mode | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const update = () => setMode(detectMode());
    update();
    window.addEventListener("installpromptready", update);
    return () => window.removeEventListener("installpromptready", update);
  }, []);

  if (!mode) return null;

  async function install() {
    const prompt = window.__installPrompt;
    if (mode === "prompt" && prompt) {
      await prompt.prompt();
      await prompt.userChoice.catch(() => {});
      // A prompt can only be used once; Chrome sends a fresh one if it's still installable.
      window.__installPrompt = null;
      setMode(detectMode());
      return;
    }
    dialog.current?.showModal();
  }

  return (
    <div className="mb-4 flex flex-col items-center gap-1.5 text-center">
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-lg border border-[#f8f1e9]/40 px-4 py-2.5 text-sm font-bold transition hover:bg-[#f8f1e9]/10 active:scale-[0.98]"
      >
        <HomeScreenIcon />
        Add to Home Screen
      </button>
      <p className="text-xs opacity-75">Keep the cookbook one tap away, even offline.</p>

      <dialog
        ref={dialog}
        aria-labelledby="install-title"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl bg-surface p-0 text-left text-foreground shadow-card backdrop:bg-[#4a3429]/50"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 id="install-title" className="font-serif text-lg leading-tight font-bold">
              Add to your Home Screen
            </h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-xl text-muted hover:bg-accent-soft"
            >
              ×
            </button>
          </div>
          {mode === "ios" ? <IosSteps /> : <AndroidSteps />}
          <button type="button" onClick={() => dialog.current?.close()} className="btn mt-5 w-full">
            Got it
          </button>
        </div>
      </dialog>
    </div>
  );
}

function IosSteps() {
  return (
    <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-[0.95rem]">
      <li>
        Tap the <b>Share</b> button <ShareIcon />. In Safari it&apos;s at the bottom of the screen (on newer
        iPhones, tap <b>•••</b> first). In Chrome it&apos;s at the top, next to the address.
      </li>
      <li>
        Scroll down and tap <b>Add to Home Screen</b>.
      </li>
      <li>
        Tap <b>Add</b>. The cookbook appears on your Home Screen like any other app.
      </li>
    </ol>
  );
}

function AndroidSteps() {
  return (
    <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-[0.95rem]">
      <li>
        Tap the browser menu <b>⋮</b> (top right, or bottom right in some browsers).
      </li>
      <li>
        Tap <b>Add to Home screen</b> or <b>Install app</b>.
      </li>
      <li>
        Tap <b>Install</b> or <b>Add</b>. The cookbook appears on your Home Screen like any other app.
      </li>
    </ol>
  );
}

function HomeScreenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M12 8v6m-3-3h6" strokeLinecap="round" />
    </svg>
  );
}

/** iOS share glyph: a box with an arrow pointing up out of it. */
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="inline size-[1.1em] -translate-y-px align-middle text-link"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Share icon"
    >
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}
