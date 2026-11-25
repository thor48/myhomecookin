"use client";

import { CATEGORIES, CATEGORY_EMOJI } from "@/lib/site";

/** Tappable category chips (one or more). Submits as repeated "category" fields. */
export function CategoryPicker({ defaultSelected = [] }: { defaultSelected?: string[] }) {
  const selected = new Set(defaultSelected.map((n) => n.toLowerCase()));
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-bold">
        Category <span className="font-normal text-muted">(pick one or more)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((name) => (
          <label key={name} className="cursor-pointer">
            <input
              type="checkbox"
              name="category"
              value={name}
              defaultChecked={selected.has(name.toLowerCase())}
              className="peer sr-only"
            />
            <span className="inline-block rounded-full border border-border bg-surface px-3.5 py-2 text-sm transition peer-checked:border-accent peer-checked:bg-accent peer-checked:font-bold peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-terracotta/40">
              {CATEGORY_EMOJI[name]} {name}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
