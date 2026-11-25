"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { RecipeDraft } from "@/lib/photo-import";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { CategoryPicker } from "@/components/category-picker";
import { keepFormSubmit } from "@/lib/keep-form";
import { createManualAction, importFromUrlAction, readPhotosAction } from "../../actions";

type Tab = "link" | "photo" | "manual";

const TABS: [Tab, string][] = [
  ["link", "Website"],
  ["photo", "Photo"],
  ["manual", "Type it"],
];

export function AddForms({ initialUrl, photoImport }: { initialUrl: string; photoImport: boolean }) {
  const [tab, setTab] = useState<Tab>("link");

  return (
    <div className="mt-6">
      <div role="tablist" className="mb-5 grid grid-cols-3 rounded-xl bg-accent-soft p-1">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-lg py-2.5 text-sm font-medium transition ${
              tab === id ? "bg-surface shadow-sm" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "link" && <LinkForm initialUrl={initialUrl} />}
      {tab === "photo" && <PhotoImport enabled={photoImport} />}
      {tab === "manual" && <ManualForm />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function LinkForm({ initialUrl }: { initialUrl: string }) {
  const [state, action, pending] = useActionState(importFromUrlAction, undefined);
  const [localError, setLocalError] = useState<string>();
  const onSubmit = keepFormSubmit(
    (fd) => {
      setLocalError(undefined);
      action(fd);
    },
    { requireCategory: setLocalError },
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Recipe link</span>
        <input
          name="url"
          type="url"
          inputMode="url"
          defaultValue={initialUrl}
          placeholder="https://…"
          required
          autoFocus={!initialUrl}
          className="field"
        />
      </label>
      <p className="text-sm text-muted">
        We&apos;ll pull out the ingredients and steps, and credit the website with a link back.
      </p>
      <CategoryPicker />
      <ErrorText error={localError ?? state?.error} />
      <button type="submit" disabled={pending} className="btn w-full">
        {pending ? "Reading the recipe…" : "Import recipe"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------

const MAX_PHOTOS = 4;

type Photo = { file: File; preview: string };

function PhotoImport({ enabled }: { enabled: boolean }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState<RecipeDraft>();
  const [preparing, setPreparing] = useState(false);
  const [reading, startReading] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  // Free preview URLs when photos are removed or the component goes away.
  const previews = useRef<string[]>([]);
  useEffect(() => {
    previews.current = photos.map((p) => p.preview);
  }, [photos]);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  if (!enabled) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-background/85 px-4 py-6 text-center text-muted">
        Photo import isn&apos;t switched on yet. Whoever runs the cookbook needs to add an AI key
        to the server.
      </p>
    );
  }

  if (draft) {
    return (
      <div>
        {draft.continues_elsewhere && (
          <div className="mb-3 rounded-xl border-2 border-accent px-4 py-3 text-sm">
            <p className="font-medium">This recipe seems to continue on the back.</p>
            <p className="mt-0.5">
              Go back, add a photo of the back (or next page), and read it again, or type the
              rest in below.
            </p>
          </div>
        )}
        <div className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm">
          <p className="font-medium">Check it over before saving.</p>
          <p className="mt-0.5">
            The photo reader can misread handwriting, so compare it with the card.
          </p>
          {draft.unclear.length > 0 && (
            <p className="mt-2">
              <span className="font-medium">Hard to read:</span> {draft.unclear.join(", ")}
            </p>
          )}
        </div>
        <ManualForm draft={draft} photos={photos.map((p) => p.file)} />
        <button
          type="button"
          onClick={() => setDraft(undefined)}
          className="mt-3 w-full py-2 text-sm text-muted underline"
        >
          ← Back to the photos
        </button>
      </div>
    );
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(undefined);
    setPreparing(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const picked = Array.from(list).slice(0, room);
      const added = await Promise.all(
        picked.map(async (f) => {
          const file = await shrinkPhoto(f);
          return { file, preview: URL.createObjectURL(file) };
        }),
      );
      setPhotos((p) => [...p, ...added]);
      if (list.length > room) setError(`Only ${MAX_PHOTOS} photos per recipe.`);
    } catch {
      setError("Couldn't open that photo. Try a JPEG or PNG.");
    } finally {
      setPreparing(false);
      if (input.current) input.current.value = "";
    }
  }

  function remove(i: number) {
    URL.revokeObjectURL(photos[i].preview);
    setPhotos((p) => p.filter((_, j) => j !== i));
  }

  function read() {
    setError(undefined);
    const form = new FormData();
    photos.forEach((p) => form.append("photos", p.file));
    startReading(async () => {
      const result = await readPhotosAction(form);
      if ("error" in result) setError(result.error);
      else setDraft(result.draft);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Snap a recipe card, a cookbook page or a screenshot. Use a few photos if it runs onto the
        back or another page.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {photos.map((p, i) => (
          <div key={p.preview} className="relative overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
            <img src={p.preview} alt={`Photo ${i + 1}`} className="aspect-[3/4] w-full bg-accent-soft object-contain" />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={reading}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/60 text-white"
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label
            className={`grid aspect-[3/4] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border bg-surface text-center text-muted ${
              photos.length === 0 ? "col-span-2 aspect-[4/3]" : ""
            }`}
          >
            <span>
              <span className="block text-3xl">📷</span>
              <span className="mt-1 block text-sm font-medium">
                {preparing ? "Preparing…" : photos.length ? "Add another" : "Take or choose a photo"}
              </span>
            </span>
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              disabled={preparing || reading}
              onChange={(e) => addFiles(e.target.files)}
              className="sr-only"
            />
          </label>
        )}
      </div>

      <ErrorText error={error} />
      <button
        type="button"
        onClick={read}
        disabled={photos.length === 0 || reading || preparing}
        className="btn w-full"
      >
        {reading ? "Reading the recipe… (about 30 seconds)" : "Read recipe"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ManualForm({ draft, photos = [] }: { draft?: RecipeDraft; photos?: File[] }) {
  const [state, action, pending] = useActionState(createManualAction, undefined);
  const [localError, setLocalError] = useState<string>();
  const [dishPhoto, setDishPhoto] = useState<File | null>(null);
  const onSubmit = keepFormSubmit(
    (fd) => {
      setLocalError(undefined);
      action(fd);
    },
    {
      requireCategory: setLocalError,
      extend: (fd) => {
        // Card photos are kept with the recipe; a dish photo becomes its main picture.
        photos.forEach((p) => fd.append("photo", p));
        if (dishPhoto) fd.set("dishPhoto", dishPhoto);
      },
    },
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Recipe name">
        <input
          name="name"
          required
          defaultValue={draft?.name}
          className="field"
          placeholder="Grandma's apple cake"
        />
      </Field>
      <DishPhotoPicker value={dishPhoto} onChange={setDishPhoto} />
      <Field label="About it" hint="optional">
        <textarea
          name="description"
          rows={2}
          defaultValue={draft?.description}
          className="field"
          placeholder="Who makes it, when you have it, why it's good…"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Serves" hint="optional">
          <input name="yield" defaultValue={draft?.servings} className="field" placeholder="8 slices" />
        </Field>
        <Field label="Time" hint="optional">
          <input name="time" defaultValue={draft?.total_time} className="field" placeholder="1 hour" />
        </Field>
      </div>
      <Field label="Ingredients" hint="one per line">
        <textarea
          name="ingredients"
          rows={Math.max(6, (draft?.ingredients.length ?? 0) + 1)}
          required
          defaultValue={draft?.ingredients.join("\n")}
          className="field"
          placeholder={"3 apples, sliced\n1 cup sugar\n2 eggs"}
        />
      </Field>
      <Field label="Steps" hint="one per line">
        <textarea
          name="steps"
          rows={Math.max(6, (draft?.steps.length ?? 0) * 2)}
          required
          defaultValue={draft?.steps.join("\n")}
          className="field"
          placeholder={"Heat the oven to 350°F.\nBeat the eggs and sugar…"}
        />
      </Field>
      <Field label="Notes" hint="optional">
        <textarea
          name="notes"
          rows={2}
          defaultValue={draft?.notes}
          className="field"
          placeholder="Tips, swaps, what Grandpa always said about it…"
        />
      </Field>
      <Field label="Whose recipe is it?" hint="optional">
        <input
          name="credit"
          defaultValue={draft?.source_credit}
          className="field"
          placeholder="Aunt Mary, or Joy of Cooking p. 212"
        />
      </Field>
      <Field label="Website it came from" hint="optional">
        <input name="source" type="url" inputMode="url" className="field" placeholder="https://…" />
      </Field>
      <CategoryPicker
        defaultSelected={draft?.category && draft.category !== "None of these" ? [draft.category] : []}
      />
      {photos.length > 0 && (
        <p className="text-sm text-muted">
          {photos.length === 1 ? "The photo" : photos.length === 2 ? "Both photos" : `All ${photos.length} photos`} will be kept with the
          recipe as the original card.
        </p>
      )}
      <ErrorText error={localError ?? state?.error} />
      <button type="submit" disabled={pending} className="btn w-full">
        {pending ? "Saving…" : "Save recipe"}
      </button>
    </form>
  );
}

/** "Photo of the dish" with a preview; shrunk in the browser like the other uploads. */
function DishPhotoPicker({ value, onChange }: { value: File | null; onChange: (f: File | null) => void }) {
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function pick(file?: File) {
    setError(undefined);
    if (!file) return;
    try {
      const small = await shrinkPhoto(file);
      onChange(small);
      setPreview(URL.createObjectURL(small));
    } catch {
      setError("Couldn't open that photo. Try a JPEG or PNG.");
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">
        Photo of the dish <span className="font-normal text-muted">(optional)</span>
      </span>
      {value && preview ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
          <img src={preview} alt="" className="h-20 w-28 rounded-lg object-cover shadow-card" />
          <button
            type="button"
            className="text-sm text-link underline"
            onClick={() => {
              onChange(null);
              setPreview(undefined);
            }}
          >
            Remove photo
          </button>
        </div>
      ) : (
        <label className="btn-quiet cursor-pointer">
          📷 Add a photo of the finished dish
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
      <ErrorText error={error} />
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label} {hint && <span className="font-normal text-muted">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  );
}
