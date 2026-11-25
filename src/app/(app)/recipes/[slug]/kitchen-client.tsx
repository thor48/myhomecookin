"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { shrinkPhoto } from "@/lib/shrink-photo";
import {
  addCommentAction,
  addMadeAction,
  editKitchenItemAction,
  removeKitchenItemAction,
} from "../../../actions";
import { callSafely, safeFormAction } from "@/lib/safe-action";

const addMadeSafely = safeFormAction(addMadeAction);
const addCommentSafely = safeFormAction(addCommentAction);

export type FeedItem = {
  kind: "made" | "comment";
  id: string;
  author: string;
  when: string;
  /** Set for comments: re-shown in the viewer's time zone once in the browser. */
  localIso: string | null;
  sortKey: number;
  text: string;
  photo: string | null;
  canChange: boolean;
};

/** Today in the person's own time zone, as YYYY-MM-DD for a date input. */
function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------

export function KitchenComposer({ slug, recipeId }: { slug: string; recipeId: string }) {
  const [open, setOpen] = useState<"made" | "comment" | null>(null);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(open === "made" ? null : "made")}
          aria-expanded={open === "made"}
          className={open === "made" ? "btn" : "btn-quiet"}
        >
          🍳 I made this
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "comment" ? null : "comment")}
          aria-expanded={open === "comment"}
          className={open === "comment" ? "btn" : "btn-quiet"}
        >
          💬 Comment
        </button>
      </div>
      {open === "made" && <MadeForm slug={slug} onDone={() => setOpen(null)} />}
      {open === "comment" && <CommentForm recipeId={recipeId} onDone={() => setOpen(null)} />}
    </div>
  );
}

function MadeForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(addMadeSafely, undefined);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [photoError, setPhotoError] = useState<string>();
  const [date] = useState(today);

  useEffect(() => {
    if (state?.done) {
      router.refresh();
      onDone();
    }
  }, [state?.done, router, onDone]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function pick(file?: File) {
    setPhotoError(undefined);
    if (!file) return;
    try {
      const small = await shrinkPhoto(file);
      setPhoto(small);
      setPreview(URL.createObjectURL(small));
    } catch {
      setPhotoError("Couldn't open that photo. Try a JPEG or PNG.");
    }
  }

  const submit = (formData: FormData) => {
    if (photo) formData.set("photo", photo);
    action(formData);
  };

  return (
    <form action={submit} className="mt-4 space-y-3 rounded-xl bg-surface p-4 shadow-card">
      <input type="hidden" name="slug" value={slug} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">When did you make it?</span>
        <input name="date" type="date" required defaultValue={date} max={today()} className="field" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">
          How did it go? <span className="font-normal text-muted">(optional)</span>
        </span>
        <textarea
          name="note"
          rows={3}
          maxLength={2000}
          className="field"
          placeholder="Doubled the gravy, everyone wanted seconds…"
        />
      </label>
      <div>
        <span className="mb-1.5 block text-sm font-bold">
          Photo <span className="font-normal text-muted">(optional)</span>
        </span>
        {preview ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
            <img src={preview} alt="" className="size-20 rounded-lg object-cover" />
            <button
              type="button"
              className="text-sm text-link underline"
              onClick={() => {
                setPhoto(null);
                setPreview(undefined);
              }}
            >
              Remove photo
            </button>
          </div>
        ) : (
          <label className="btn-quiet cursor-pointer">
            📷 Add a photo of how it turned out
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {(photoError || state?.error) && (
        <p role="alert" className="text-sm text-danger">
          {photoError ?? state?.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn w-full">
        {pending ? "Saving…" : "Log it"}
      </button>
    </form>
  );
}

function CommentForm({ recipeId, onDone }: { recipeId: string; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(addCommentSafely, undefined);
  useEffect(() => {
    if (state?.done) {
      router.refresh();
      onDone();
    }
  }, [state?.done, router, onDone]);

  return (
    <form action={action} className="mt-4 space-y-3 rounded-xl bg-surface p-4 shadow-card">
      <input type="hidden" name="recipeId" value={recipeId} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Comment</span>
        <textarea
          name="text"
          rows={3}
          required
          maxLength={2000}
          autoFocus
          className="field"
          placeholder="A question, a tip, a memory…"
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn w-full">
        {pending ? "Posting…" : "Post comment"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------

export function KitchenFeed({ items }: { items: FeedItem[] }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  if (items.length === 0) {
    return (
      <p className="mt-5 rounded-xl border border-dashed border-border bg-background/85 px-4 py-6 text-center text-muted">
        Made this? Tap &ldquo;I made this&rdquo; to add it here, with a photo if you like.
      </p>
    );
  }

  return (
    <>
      <ol className="mt-5 space-y-3">
        {items.map((item) => (
          <FeedEntry
            key={`${item.kind}-${item.id}`}
            item={item}
            onPhoto={(src) => {
              setPhoto(src);
              dialog.current?.showModal();
            }}
          />
        ))}
      </ol>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-auto max-h-[92dvh] w-[min(96vw,48rem)] rounded-2xl bg-surface p-0 backdrop:bg-black/80"
      >
        <div className="flex justify-end border-b border-border px-3 py-2">
          <button type="button" className="btn-quiet px-3 py-1.5" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- served via /made-photo proxy
          <img src={`${photo}?size=original`} alt="" className="max-h-[calc(92dvh-3.5rem)] w-full object-contain" />
        )}
      </dialog>
    </>
  );
}

/** Server shows a UTC day; the browser swaps in the viewer's local day. */
function When({ fallback, iso }: { fallback: string; iso: string | null }) {
  // false while rendering on the server and hydrating, true after: no mismatch.
  const inBrowser = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!iso || !inBrowser) return <>{fallback}</>;
  return <>{new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>;
}

const noopSubscribe = () => () => {};

function FeedEntry({ item, onPhoto }: { item: FeedItem; onPhoto: (src: string) => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState(item.text);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const made = item.kind === "made";

  function save() {
    setError(undefined);
    start(async () => {
      const r = await callSafely(() => editKitchenItemAction(item.kind, item.id, text));
      if (r.error) setError(r.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function remove() {
    setError(undefined);
    start(async () => {
      const r = await callSafely(() => removeKitchenItemAction(item.kind, item.id));
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <li className={`rounded-xl p-4 ${made ? "bg-surface shadow-card" : "border border-border"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm">
          <span aria-hidden>{made ? "🍳 " : "💬 "}</span>
          <span className="font-bold">{item.author}</span>
          <span className="text-muted">
            {made ? " made this" : ""} · <When fallback={item.when} iso={item.localIso} />
          </span>
        </p>
        {item.canChange && !editing && !confirming && (
          <span className="flex shrink-0 gap-3 text-xs">
            <button type="button" className="text-link underline" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="text-danger underline" onClick={() => setConfirming(true)}>
              Remove
            </button>
          </span>
        )}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            className="field"
            aria-label={made ? "Note" : "Comment"}
          />
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending} className="btn px-4 py-2 text-sm">
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setText(item.text);
              }}
              className="btn-quiet"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        item.text && <p className="mt-1.5 whitespace-pre-line">{item.text}</p>
      )}

      {item.photo && (
        <button type="button" onClick={() => onPhoto(item.photo!)} className="mt-3 block" aria-label="View photo">
          {/* eslint-disable-next-line @next/next/no-img-element -- served via /made-photo proxy */}
          <img
            src={`${item.photo}?size=min-original`}
            alt={`${item.author}'s photo`}
            loading="lazy"
            className="max-h-56 rounded-lg object-cover"
          />
        </button>
      )}

      {confirming && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span>Remove this {made ? "entry" : "comment"}?</span>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-lg bg-danger px-3 py-1.5 font-bold text-white disabled:opacity-60"
          >
            {pending ? "Removing…" : "Remove"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="btn-quiet px-3 py-1.5">
            Keep
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
