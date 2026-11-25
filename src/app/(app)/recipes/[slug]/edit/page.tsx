import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  cardAssets,
  dishAssets,
  featuredPhoto,
  getRecipe,
  listMadeEntries,
  MealieError,
  memberNames,
  recipeAccess,
  type Recipe,
} from "@/lib/mealie";
import { editableText } from "@/lib/recipe-edit";
import { currentUser, withMealie } from "@/lib/session";
import { DeleteRecipe, EditForm } from "./edit-form";
import { PhotoPicker, type PhotoChoice } from "./photo-picker";

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
          <PhotoPicker
            slug={recipe.slug}
            current={recipe.image ? `/img/${recipe.id}?size=min-original&v=${recipe.image}` : null}
            featured={featuredPhoto(recipe)}
            choices={await photoChoices(recipe)}
          />
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

/** Every photo the recipe has: dish photos, "I made this" photos, then the recipe card. */
async function photoChoices(recipe: Recipe): Promise<PhotoChoice[]> {
  const [made, names] = await withMealie((t) => Promise.all([listMadeEntries(t, recipe.id), memberNames(t)]));
  const cards = cardAssets(recipe);
  const dishes = dishAssets(recipe);
  return [
    ...dishes.map((a, i) => ({
      key: `dish:${a.fileName}`,
      src: `/asset/${recipe.id}/${a.fileName}`,
      label: dishes.length > 1 ? `Dish photo ${i + 1}` : "Dish photo",
      removable: true,
    })),
    ...made
      .filter((e) => e.image === "has image")
      .map((e) => ({
        key: `made:${e.id}`,
        src: `/made-photo/${recipe.id}/${e.id}`,
        label: `Made by ${names.get(e.userId) ?? e.subject.replace(/ made this$/, "")}`,
      })),
    ...cards.map((a, i) => ({
      key: `card:${a.fileName}`,
      src: `/asset/${recipe.id}/${a.fileName}`,
      label: cards.length > 1 ? `Recipe card ${i + 1}` : "Recipe card",
    })),
  ];
}
