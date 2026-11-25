"use client";

import { useState, useTransition } from "react";
import { createInviteAction } from "../../actions";
import { callSafely } from "@/lib/safe-action";
import { SITE_NAME } from "@/lib/site";

const CHOICES = [
  [1, "One person"],
  [5, "Up to 5 people"],
  [10, "Up to 10 people"],
] as const;

export function InviteForm() {
  const [uses, setUses] = useState<number>(1);
  const [link, setLink] = useState<{ url: string; uses: number }>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  function create() {
    setError(undefined);
    setCopied(false);
    start(async () => {
      const result = await callSafely(() => createInviteAction(uses));
      if ("error" in result) setError(result.error);
      else setLink(result);
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it instead.");
    }
  }

  async function share() {
    if (!link) return;
    try {
      await navigator.share({
        title: `Join ${SITE_NAME}`,
        text: `Come share recipes with us on ${SITE_NAME}! Use this link to make your account:`,
        url: link.url,
      });
    } catch {
      // Closing the share sheet isn't an error.
    }
  }

  if (link) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-xl bg-surface p-4 shadow-card">
          <p className="mb-2 text-sm text-muted">
            {link.uses === 1
              ? "This link works for one person."
              : `Up to ${link.uses} people can join with this link.`}{" "}
            Once it&apos;s used up it stops working.
          </p>
          <p className="rounded-lg bg-accent-soft px-3 py-2 font-mono text-sm break-all select-all">
            {link.url}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canShare && (
            <button type="button" onClick={share} className="btn flex-1">
              Share link
            </button>
          )}
          <button type="button" onClick={copy} className={canShare ? "btn-quiet flex-1" : "btn flex-1"}>
            {copied ? "✓ Copied" : "Copy link"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => setLink(undefined)}
          className="w-full py-2 text-sm text-muted underline"
        >
          Make another link
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-bold">Who&apos;s it for?</legend>
        <div className="grid grid-cols-3 gap-2">
          {CHOICES.map(([value, label]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border px-2 py-3 text-center text-sm transition ${
                uses === value
                  ? "border-terracotta bg-accent-soft font-bold"
                  : "border-border bg-surface"
              }`}
            >
              <input
                type="radio"
                name="uses"
                value={value}
                checked={uses === value}
                onChange={() => setUses(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="button" onClick={create} disabled={pending} className="btn w-full">
        {pending ? "Making link…" : "Make invite link"}
      </button>
      <p className="text-sm text-muted">
        Anyone with the link can join, so send it only to the people you mean.
      </p>
    </div>
  );
}
