"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteRecipeAction, updateRecipeAction } from "../../../../actions";

type Initial = {
  name: string;
  description: string;
  yield: string;
  time: string;
  ingredients: string[];
  steps: string[];
  notes: string;
  credit: string;
  source: string;
};

export function EditForm({ slug, initial }: { slug: string; initial: Initial }) {
  const [state, action, pending] = useActionState(updateRecipeAction, undefined);

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <Field label="Recipe name">
        <input name="name" required defaultValue={initial.name} className="field" />
      </Field>
      <Field label="About it" hint="optional">
        <textarea name="description" rows={2} defaultValue={initial.description} className="field" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Serves / makes" hint="optional">
          <input name="yield" defaultValue={initial.yield} className="field" placeholder="8 slices" />
        </Field>
        <Field label="Time" hint="optional">
          <input name="time" defaultValue={initial.time} className="field" placeholder="1 hour" />
        </Field>
      </div>
      <Field label="Ingredients" hint="one per line">
        <textarea
          name="ingredients"
          required
          rows={Math.max(6, initial.ingredients.length + 1)}
          defaultValue={initial.ingredients.join("\n")}
          className="field"
        />
      </Field>
      <Field label="Steps" hint="one per line">
        <textarea
          name="steps"
          required
          rows={Math.max(6, initial.steps.length * 2)}
          defaultValue={initial.steps.join("\n")}
          className="field"
        />
      </Field>
      <Field label="Notes" hint="optional">
        <textarea name="notes" rows={3} defaultValue={initial.notes} className="field" />
      </Field>
      <Field label="Whose recipe is it?" hint="optional">
        <input
          name="credit"
          defaultValue={initial.credit}
          className="field"
          placeholder="Aunt Mary, or Joy of Cooking p. 212"
        />
      </Field>
      <Field label="Website it came from" hint="optional">
        <input name="source" type="url" inputMode="url" defaultValue={initial.source} className="field" />
      </Field>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn w-full">
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

/** Admin only. Asks for a second tap before deleting. */
export function DeleteRecipe({ slug, name }: { slug: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function remove() {
    setError(undefined);
    start(async () => {
      const result = await deleteRecipeAction(slug);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <section className="mt-12 rounded-xl border border-danger/40 p-4">
      <h2 className="font-serif text-lg font-bold">Delete recipe</h2>
      <p className="mt-1 text-sm text-muted">
        Removes &ldquo;{name}&rdquo; and its photos for everyone. This can&apos;t be undone.
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 rounded-lg border border-danger px-4 py-2.5 text-sm font-bold text-danger transition hover:bg-danger/10"
        >
          Delete recipe…
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-lg bg-danger px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Yes, delete it"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="btn-quiet"
          >
            Keep it
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold">
        {label} {hint && <span className="font-normal text-muted">({hint})</span>}
      </span>
      {children}
    </label>
  );
}
