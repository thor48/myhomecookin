"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { addRecipePhotoAction } from "../../../actions";
import { RELOAD_MESSAGE } from "./edit/photo-picker";

/** "Add a photo of the dish" / "Add a card photo" buttons on a recipe page. */
export function AddPhoto({ slug }: { slug: string }) {
  const router = useRouter();
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, start] = useTransition();

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
    start(async () => {
      try {
        const result = await addRecipePhotoAction(undefined, form);
        if (result?.error) setError(result.error);
        // Show the new photo once it's saved.
        else router.refresh();
      } catch (e) {
        unstable_rethrow(e); // let a redirect (e.g. signed out) through
        // e.g. the site was updated while this page was open
        setError(RELOAD_MESSAGE);
      }
    });
  }

  const busy = preparing || saving;
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
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
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
