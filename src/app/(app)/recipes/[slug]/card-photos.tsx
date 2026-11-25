"use client";

import { useRef, useState } from "react";

type Card = { name: string; src: string };

/** Thumbnails of the original recipe card. Tap one to see it full size. */
export function CardPhotos({ cards }: { cards: Card[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(0);

  const show = (i: number) => {
    setOpen(i);
    dialog.current?.showModal();
  };

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c, i) => (
          <li key={c.src}>
            <button
              type="button"
              onClick={() => show(i)}
              className="block w-full overflow-hidden rounded-xl border border-border bg-surface transition active:scale-[0.98]"
              aria-label={`View ${c.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- served via /asset proxy */}
              <img src={c.src} alt="" loading="lazy" className="aspect-[4/3] w-full bg-accent-soft object-contain" />
              <span className="block px-2 py-1.5 text-left text-xs text-muted">
                {cards.length > 1 ? (i === 0 ? "Front" : i === 1 ? "Back" : `Page ${i + 1}`) : "The card"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-auto max-h-[92dvh] w-[min(96vw,56rem)] rounded-xl bg-surface p-0 text-foreground backdrop:bg-black/80"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <span className="text-sm text-muted">
            {cards.length > 1 ? `${open + 1} of ${cards.length}` : "Original recipe card"}
          </span>
          <div className="flex items-center gap-2">
            {cards.length > 1 && (
              <>
                <button
                  type="button"
                  className="btn-quiet px-3 py-1.5"
                  aria-label="Previous"
                  onClick={() => setOpen((o) => (o - 1 + cards.length) % cards.length)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="btn-quiet px-3 py-1.5"
                  aria-label="Next"
                  onClick={() => setOpen((o) => (o + 1) % cards.length)}
                >
                  →
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-quiet px-3 py-1.5"
              onClick={() => dialog.current?.close()}
            >
              Close
            </button>
          </div>
        </div>
        {cards[open] && (
          // eslint-disable-next-line @next/next/no-img-element -- served via /asset proxy
          <img
            src={cards[open].src}
            alt={cards[open].name}
            className="max-h-[calc(92dvh-3.5rem)] w-full object-contain"
          />
        )}
      </dialog>
    </>
  );
}
