"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { addRecipePhotoAction, removeDishPhotoAction, setFeaturedPhotoAction } from "../../../../actions";

export type PhotoChoice = {
  /** "dish:<file>", "card:<file>" or "made:<entryId>" */
  key: string;
  src: string;
  label: string;
  /** Dish photos can be removed (except the featured one). */
  removable?: boolean;
};

/**
 * On the edit page: the recipe's featured photo, a button to add a photo of
 * the dish, and every photo it has (dish, "I made this", recipe card). Tap one
 * to make it the picture shown on the recipe and its card. Saves right away.
 */
export function PhotoPicker({
  slug,
  current,
  featured,
  choices,
}: {
  slug: string;
  /** The recipe's main picture now, if it has one. */
  current: string | null;
  /** Which choice it is, when known. */
  featured: string | null;
  choices: PhotoChoice[];
}) {
  const router = useRouter();
  const [state, upload, uploading] = useActionState(addRecipePhotoAction, undefined);
  const [preparing, setPreparing] = useState(false);
  const [choosing, setChoosing] = useState<string>();
  const [confirmRemove, setConfirmRemove] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  // Show the new photo once it's saved.
  useEffect(() => {
    if (state?.done) router.refresh();
  }, [state?.done, router]);

  async function addDishPhoto(file?: File) {
    if (!file) return;
    setError(undefined);
    setPreparing(true);
    let photo: File;
    try {
      photo = await shrinkPhoto(file);
    } catch {
      setError("Couldn't open that photo. Try a JPEG or PNG.");
      return;
    } finally {
      setPreparing(false);
    }
    const form = new FormData();
    form.set("slug", slug);
    form.set("kind", "dish");
    form.set("photo", photo);
    start(() => upload(form));
  }

  function choose(key: string) {
    if (key === featured || busy) return;
    setError(undefined);
    setChoosing(key);
    start(async () => {
      const result = await setFeaturedPhotoAction(slug, key);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  function remove(key: string) {
    if (confirmRemove !== key) return setConfirmRemove(key);
    setError(undefined);
    setChoosing(key);
    start(async () => {
      const result = await removeDishPhotoAction(slug, key.slice("dish:".length));
      if (result.error) setError(result.error);
      setConfirmRemove(undefined);
      router.refresh();
    });
  }

  const busy = preparing || uploading || pending;
  const shown = error ?? state?.error;
  // When the current picture isn't one of the choices (an older recipe), show it too.
  const unknownCurrent = current && !choices.some((c) => c.key === featured);

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-4" aria-labelledby="photos">
      <h2 id="photos" className="font-serif text-xl font-bold">
        Featured photo
      </h2>
      <p className="mt-1 text-sm text-muted">
        The picture at the top of the recipe and on its card. Add a photo of the finished dish, or tap
        any photo below to feature it. Photo changes save right away.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl bg-accent-soft">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element -- served via /img proxy
          <img src={current} alt="Featured photo" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center p-6 text-center text-muted">
            No photo yet. Add one of the finished dish.
          </div>
        )}
      </div>

      <label
        className={`btn mt-3 w-full cursor-pointer text-center ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        {preparing || uploading ? "Saving photo…" : "📷 Add a photo of the dish"}
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            addDishPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-1.5 text-center text-xs text-muted">A new dish photo becomes the featured photo.</p>

      {shown && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {shown}
        </p>
      )}

      {(choices.length > 0 || unknownCurrent) && (
        <>
          <h3 className="mt-5 mb-2 text-sm font-bold">Choose from this recipe&apos;s photos</h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {unknownCurrent && (
              <li>
                <Tile src={current} label="Current photo" selected disabled />
              </li>
            )}
            {choices.map((c) => (
              <li key={c.key}>
                <Tile
                  src={c.src}
                  label={c.label}
                  selected={c.key === featured}
                  saving={pending && choosing === c.key && confirmRemove !== c.key}
                  disabled={busy}
                  onClick={() => choose(c.key)}
                />
                {c.removable && c.key !== featured && (
                  <button
                    type="button"
                    onClick={() => remove(c.key)}
                    onBlur={() => !pending && setConfirmRemove(undefined)}
                    disabled={busy}
                    className={`mt-1 w-full rounded-md px-1.5 py-1 text-xs transition disabled:opacity-60 ${
                      confirmRemove === c.key ? "bg-danger font-bold text-white" : "text-danger hover:bg-danger/10"
                    }`}
                  >
                    {confirmRemove === c.key ? (pending ? "Removing…" : "Tap again to remove") : "Remove"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Tile({
  src,
  label,
  selected,
  saving,
  disabled,
  onClick,
}: {
  src: string;
  label: string;
  selected: boolean;
  saving?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || selected}
      aria-pressed={selected}
      aria-label={selected ? `${label} (featured)` : `Feature ${label}`}
      className={`relative block w-full overflow-hidden rounded-lg border-2 bg-background text-left transition active:scale-[0.98] disabled:active:scale-100 ${
        selected ? "border-accent" : "border-transparent hover:border-border"
      } ${disabled && !selected ? "opacity-60" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- served via app proxies */}
      <img src={src} alt="" loading="lazy" className="aspect-square w-full bg-accent-soft object-cover" />
      {(selected || saving) && (
        <span className="absolute top-1 left-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">
          {saving ? "Saving…" : "★ Featured"}
        </span>
      )}
      <span className="block truncate px-1.5 py-1 text-xs text-muted">{label}</span>
    </button>
  );
}
