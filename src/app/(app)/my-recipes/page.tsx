import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GridSkeleton, ListTabs, RecipeGrid } from "@/components/recipe-grid";
import { getFavoriteIds, listFavoriteRecipes, listRecipesAddedBy } from "@/lib/mealie";
import { currentUser, withMealie } from "@/lib/session";

export const metadata: Metadata = { title: "My Recipes" };

export default function MyRecipesPage() {
  return (
    <>
      <ListTabs current="mine" />
      <Suspense fallback={<GridSkeleton />}>
        <MyLists />
      </Suspense>
    </>
  );
}

async function MyLists() {
  const self = await currentUser();
  const [favorites, added, favoriteIds] = await withMealie((t) =>
    Promise.all([listFavoriteRecipes(t), listRecipesAddedBy(t, self.id), getFavoriteIds(t)]),
  );

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-1 font-serif text-2xl font-bold">♥ Favorites</h1>
        {favorites.length === 0 ? (
          <Empty>
            Nothing saved yet. Tap the ♥ on any recipe to keep it here.{" "}
            <Link href="/" className="font-bold text-link underline">
              Browse recipes
            </Link>
          </Empty>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              {favorites.length} {favorites.length === 1 ? "recipe" : "recipes"} you&apos;ve saved.
            </p>
            {/* Refresh so a recipe leaves this list when its ♥ is tapped off. */}
            <RecipeGrid recipes={favorites} favorites={favoriteIds} refreshOnFavorite />
          </>
        )}
      </section>

      <section>
        <h2 className="mb-1 font-serif text-2xl font-bold">Added by me</h2>
        {added.length === 0 ? (
          <Empty>
            You haven&apos;t added any recipes yet.{" "}
            <Link href="/add" className="font-bold text-link underline">
              Add one
            </Link>
          </Empty>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              {added.length} {added.length === 1 ? "recipe" : "recipes"}. You can edit any of these.
            </p>
            <RecipeGrid recipes={added} favorites={favoriteIds} refreshOnFavorite />
          </>
        )}
      </section>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 rounded-xl border border-dashed border-border px-4 py-6 text-center text-muted">
      {children}
    </p>
  );
}
