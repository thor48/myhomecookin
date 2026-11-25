"use client";

import { useState, useTransition } from "react";
import { passwordResetLinkAction } from "../../actions";
import { callSafely } from "@/lib/safe-action";

/** Admin: make a one-time "set a new password" link for someone and copy it. */
export function ResetLinkButton({ userId, name }: { userId: string; name: string }) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function create() {
    setError(undefined);
    setCopied(false);
    start(async () => {
      const result = await callSafely(() => passwordResetLinkAction(userId));
      if ("error" in result) setError(result.error);
      else setUrl(result.url);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it instead.");
    }
  }

  if (!url) {
    return (
      <div>
        <button type="button" onClick={create} disabled={pending} className="text-sm text-link underline">
          {pending ? "Making link…" : "Password reset link"}
        </button>
        {error && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-accent-soft p-3">
      <p className="text-xs text-muted">
        Send this to {name}. It works once, for the next hour, and any older reset link for them stops working.
      </p>
      <p className="font-mono text-xs break-all select-all">{url}</p>
      <div className="flex gap-3 text-sm">
        <button type="button" onClick={copy} className="font-bold text-link underline">
          {copied ? "✓ Copied" : "Copy link"}
        </button>
        <button type="button" onClick={() => setUrl(undefined)} className="text-muted underline">
          Done
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
