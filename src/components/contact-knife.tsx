"use client";

import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { contactAction } from "@/app/actions";
import { keepFormSubmit } from "@/lib/keep-form";
import { safeFormAction } from "@/lib/safe-action";

const sendSafely = safeFormAction(contactAction, { minMs: 500 });

const KINDS = [
  { value: "bug", label: "Bug", icon: "🐞" },
  { value: "idea", label: "Idea", icon: "💡" },
] as const;

/**
 * "Contact" knife fixed to the upper right. Closed, only the handle and part
 * of the blade stick out from the edge of the screen. Pressing it slides in a
 * butcher block with the knife stuck in its top and a bug / idea form inside.
 * Who sent it comes from the signed-in account, so there's nothing else to fill in.
 * Layout and motion live in globals.css (.contact-*).
 */
export function ContactKnife() {
  const page = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"bug" | "idea" | "">("");
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState(sendSafely, undefined);
  // The send that's been thanked for and cleared away.
  const [doneWith, setDoneWith] = useState<number>();
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Sent: say thanks, slide away, then start fresh for next time.
  const sentAt = state?.sent;
  useEffect(() => {
    if (!sentAt) return;
    const close = setTimeout(() => setOpen(false), 1600);
    const reset = setTimeout(() => {
      setDoneWith(sentAt);
      setKind("");
      setText("");
    }, 2400);
    return () => {
      clearTimeout(close);
      clearTimeout(reset);
    };
  }, [sentAt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const showThanks = sentAt !== undefined && sentAt !== doneWith;
  const error = !showThanks && state?.error;

  return (
    <div className="contact-frame">
      <div aria-hidden className="contact-backdrop" data-open={open || undefined} onClick={() => setOpen(false)} />
      <aside className="contact-panel" data-open={open || undefined} aria-label="Contact us">
        <button
          type="button"
          className="contact-knife"
          aria-expanded={open}
          aria-controls="contact-block"
          aria-label={open ? "Close contact form" : "Contact us: report a bug or share an idea"}
          onClick={() => setOpen((o) => !o)}
        >
          <Knife />
        </button>

        <div id="contact-block" className="contact-block" inert={!open}>
          <span aria-hidden className="contact-slot" />
          <div className="contact-card">
            {showThanks ? (
              <div role="status" className="py-8 text-center">
                <p className="font-serif text-xl font-bold">Thank you!</p>
                <p className="mt-1 text-sm text-muted">It&apos;s on its way to the kitchen.</p>
              </div>
            ) : (
              <form
                onSubmit={keepFormSubmit(action, {
                  extend: (fd) => fd.set("page", page),
                })}
                className="space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-lg leading-tight font-bold">Found a bug? Got an idea?</h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-xl text-muted hover:bg-accent-soft"
                  >
                    ×
                  </button>
                </div>
                <fieldset className="flex gap-2">
                  <legend className="sr-only">What is it?</legend>
                  {KINDS.map((k) => (
                    <label key={k.value} className="contact-bubble">
                      <input
                        type="radio"
                        name="kind"
                        value={k.value}
                        checked={kind === k.value}
                        onChange={() => {
                          setKind(k.value);
                          textRef.current?.focus();
                        }}
                        className="sr-only"
                      />
                      <span aria-hidden>{k.icon}</span> {k.label}
                    </label>
                  ))}
                </fieldset>
                <label className="block">
                  <span className="sr-only">Message</span>
                  <textarea
                    ref={textRef}
                    name="message"
                    rows={4}
                    maxLength={2000}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      kind === "bug"
                        ? "What happened, and what did you expect?"
                        : kind === "idea"
                          ? "What would make the cookbook better?"
                          : "Pick Bug or Idea, then tell us about it"
                    }
                    className="field resize-none text-[0.95rem]"
                  />
                </label>
                {error && (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={pending || !kind || !text.trim()} className="btn w-full">
                  {pending ? "Sending…" : "Send"}
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

/** A chef's knife drawn flat, tip to the right; CSS tilts it 45°. */
function Knife() {
  return (
    <svg viewBox="0 0 220 34" width={220} height={34} aria-hidden className="block overflow-visible">
      <defs>
        <linearGradient id="ck-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f5f6" />
          <stop offset="0.45" stopColor="#c9cdd1" />
          <stop offset="0.8" stopColor="#a9afb5" />
          <stop offset="1" stopColor="#e8eaec" />
        </linearGradient>
        <linearGradient id="ck-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a4e33" />
          <stop offset="0.5" stopColor="#5a3826" />
          <stop offset="1" stopColor="#3d261a" />
        </linearGradient>
        <linearGradient id="ck-bolster" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2e4e6" />
          <stop offset="1" stopColor="#8f959b" />
        </linearGradient>
      </defs>
      {/* Blade: straight spine on top, edge curving up to the tip */}
      <path d="M95 4 H194 Q212 6 220 15 Q188 31 95 30 Z" fill="url(#ck-steel)" stroke="#8d9399" strokeWidth="0.75" />
      <path d="M97 27.5 Q170 28.5 214 15.5" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1" />
      <text
        x="138"
        y="20.5"
        textAnchor="middle"
        className="contact-knife-label"
        fontSize="10.5"
        fontWeight="700"
        letterSpacing="2.2"
        fill="#4a3429"
        fillOpacity="0.8"
      >
        CONTACT
      </text>
      {/* Bolster */}
      <rect x="83" y="6" width="13" height="22" rx="3" fill="url(#ck-bolster)" stroke="#7c8288" strokeWidth="0.75" />
      {/* Handle with three brass rivets */}
      <path d="M84 9 H12 Q2 9 1 17 Q2 25 12 25 H84 Z" fill="url(#ck-wood)" stroke="#2f1d13" strokeWidth="0.75" />
      <path d="M12 11.5 H80" stroke="#a8724c" strokeOpacity="0.55" strokeWidth="1" />
      {[22, 46, 70].map((x) => (
        <circle key={x} cx={x} cy="17" r="2.6" fill="#d8b46a" stroke="#8a6a2e" strokeWidth="0.6" />
      ))}
    </svg>
  );
}
