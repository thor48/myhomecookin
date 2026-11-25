import type { Metadata } from "next";
import { Suspense } from "react";
import { photoImportEnabled } from "@/lib/photo-import";
import { AddForms } from "./add-forms";

export const metadata: Metadata = { title: "Add a recipe" };

export default function AddPage({ searchParams }: PageProps<"/add">) {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-3xl font-semibold">Add a recipe</h1>
      <p className="mt-1 text-muted">Share something you love to make.</p>
      <Suspense fallback={<AddForms initialUrl="" photoImport />}>
        <AddFormsWithShared searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/**
 * When the app is installed on Android, "Share → Family Recipes" from the
 * browser opens /add?url=…&text=… (see manifest.ts). Some apps put the link
 * in `text`, so pull the first URL out of either.
 */
async function AddFormsWithShared({ searchParams }: { searchParams: PageProps<"/add">["searchParams"] }) {
  const sp = await searchParams;
  const candidates = [sp.url, sp.text, sp.title].flat().filter(Boolean).join(" ");
  const shared = candidates.match(/https?:\/\/\S+/)?.[0] ?? "";
  // Read at request time, so the key can be set on the container after the build.
  return <AddForms initialUrl={shared} photoImport={photoImportEnabled()} />;
}
