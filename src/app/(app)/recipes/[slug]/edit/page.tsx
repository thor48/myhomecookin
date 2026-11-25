import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getRecipe, MealieError, recipeAccess } from "@/lib/mealie";
import { editableText } from "@/lib/recipe-edit";
import { currentUser, withMealie } from "@/lib/session";
import { DeleteRecipe, EditForm } from "./edit-form";

export const metadata: Metadata = { title: "Edit recipe" };

type Props = PageProps<"/recipes/[slug]/edit">;

export default function EditPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-xl">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  let recipe;
  try {
    recipe = await withMealie((t) => getRecipe(t, slug));
  } catch (e) {
    if (e instanceof MealieError && e.status === 404) notFound();
    throw e;
  }
  const access = recipeAccess(await currentUser(), recipe);

  return (
    <>
      <Link href={`/recipes/${slug}`} className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        ← Back to the recipe
      </Link>
      <h1 className="font-serif text-3xl font-bold">Edit recipe</h1>
      {access.canEdit ? (
        <>
          <EditForm slug={slug} initial={editableText(recipe)} />
          {access.canDelete && <DeleteRecipe slug={slug} name={recipe.name} />}
        </>
      ) : (
        <p className="mt-4 rounded-xl bg-accent-soft px-4 py-4">
          You can only edit recipes you added. Ask whoever added it, or an admin, to make the change.
        </p>
      )}
    </>
  );
}
