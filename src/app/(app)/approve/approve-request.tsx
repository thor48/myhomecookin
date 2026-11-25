"use client";

import { useEffect, useState, useTransition } from "react";
import { approveRequestAction } from "../../actions";
import { SITE_NAME } from "@/lib/site";

type Request = { name: string; email: string; note: string; at: number };

/** Request details come after "#" in the link, which never reaches the server. */
function readRequest(hash: string): Request | null {
  const encoded = new URLSearchParams(hash.replace(/^#/, "")).get("r");
  if (!encoded) return null;
  try {
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0),
    );
    const d = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof d.n !== "string" || typeof d.e !== "string") return null;
    return { name: d.n, email: d.e, note: typeof d.m === "string" ? d.m : "", at: Number(d.t) || 0 };
  } catch {
    return null;
  }
}

function inviteEmail(request: Request, url: string) {
  const first = request.name.split(/\s+/)[0];
  const subject = `You're invited to ${SITE_NAME}`;
  const body =
    `Hi ${first},\n\n` +
    `Here's your invite to our family cookbook, ${SITE_NAME}:\n\n${url}\n\n` +
    `Open the link to make your account. It works once.\n`;
  return `mailto:${encodeURIComponent(request.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function ApproveRequest() {
  const [request, setRequest] = useState<Request | null | undefined>(undefined);
  const [link, setLink] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  // Read the link's "#" part once the page is in the browser.
  useEffect(() => {
    const read = () => setRequest(readRequest(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  if (request === undefined) return null;
  if (request === null) {
    return (
      <p className="mt-4 rounded-xl bg-accent-soft px-4 py-4">
        This page opens from a join request in Discord. Use the &ldquo;Review and approve&rdquo;
        link there.
      </p>
    );
  }

  function approve() {
    setError(undefined);
    start(async () => {
      const result = await approveRequestAction(request!.name);
      if ("error" in result) setError(result.error);
      else setLink(result.url);
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it instead.");
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <dl className="space-y-3 rounded-xl bg-surface p-4 shadow-card">
        <div>
          <dt className="text-xs text-muted">Name</dt>
          <dd className="font-serif text-xl font-bold">{request.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Email</dt>
          <dd className="break-all">{request.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">How they know us</dt>
          <dd className="whitespace-pre-line">{request.note || "—"}</dd>
        </div>
        {request.at > 0 && (
          <div>
            <dt className="text-xs text-muted">Asked</dt>
            <dd className="text-sm">
              {new Date(request.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </dd>
          </div>
        )}
      </dl>

      {!link ? (
        <>
          <button type="button" onClick={approve} disabled={pending} className="btn w-full">
            {pending ? "Making their invite…" : "Approve and make invite"}
          </button>
          <p className="text-sm text-muted">
            Not someone you know? Just ignore the request: nothing happens unless you approve.
          </p>
        </>
      ) : (
        <div className="space-y-3">
          <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm">
            <span className="font-bold">Approved.</span> Send {request.name.split(/\s+/)[0]} their
            invite. The link works for one account.
          </p>
          <p className="rounded-lg bg-surface px-3 py-2 font-mono text-sm break-all shadow-card select-all">
            {link}
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={inviteEmail(request, link)} className="btn flex-1">
              Email invite
            </a>
            <button type="button" onClick={copy} className="btn-quiet flex-1">
              {copied ? "✓ Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
