"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { addRecipePhotoAction } from "../../../actions";

/** "Add a photo of the dish" / "Add a card photo" buttons on a recipe page. */
export function AddPhoto({ slug }: { slug: string }) {
  const router = useRouter();
  const [state, action, saving] = useActionState(addRecipePhotoAction, undefined);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  // Show the new photo once it's saved.
  useEffect(() => {
    if (state?.done) router.refresh();
  }, [state?.done, router]);

  async function upload(kind: "dish" | "card", file?: File) {
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
    form.set("kind", kind);
    form.set("photo", photo);
    startTransition(() => action(form));
  }

  const busy = preparing || saving;
  const shown = error ?? state?.error;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <PhotoButton
          label={busy ? "Saving photo…" : "📷 Photo of the dish"}
          disabled={busy}
          onPick={(f) => upload("dish", f)}
        />
        <PhotoButton label="🗂️ Add a card photo" disabled={busy} onPick={(f) => upload("card", f)} />
      </div>
      {shown && (
        <p role="alert" className="mt-2 text-sm text-accent">
          {shown}
        </p>
      )}
    </div>
  );
}

function PhotoButton({
  label,
  disabled,
  onPick,
}: {
  label: string;
  disabled: boolean;
  onPick: (file?: File) => void;
}) {
  return (
    <label className={`btn-quiet cursor-pointer ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      {label}
      <input
        type="file"
        accept="image/*"
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}
