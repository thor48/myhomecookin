"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Submit a form to a server action WITHOUT React's automatic form reset, so
 * nothing typed is lost when the server sends back an error. Also checks that
 * at least one category chip is picked before sending anything.
 */
export function keepFormSubmit(
  dispatch: (formData: FormData) => void,
  opts: { requireCategory?: (message: string) => void; extend?: (formData: FormData) => void } = {},
) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (opts.requireCategory && formData.getAll("category").length === 0) {
      opts.requireCategory("Pick a category for this recipe.");
      return;
    }
    opts.extend?.(formData);
    startTransition(() => dispatch(formData));
  };
}
