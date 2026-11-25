import Link from "next/link";
import type { RecipeSummary } from "@/lib/mealie";
import { FavoriteButton } from "./favorite-button";
import { SourceCredit } from "./source-credit";

/** Grid of recipe cards with a ♥ on each. Used by the home page and My Recipes. */
export function RecipeGrid({
  recipes,
  favorites,
  refreshOnFavorite = false,
}: {
  recipes: RecipeSummary[];
  favorites: Set<string>;
  refreshOnFavorite?: boolean;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {recipes.map((r) => (
        <li key={r.id} className="relative">
          <RecipeCard recipe={r} />
          {/* Outside the link, so tapping the heart doesn't open the recipe. */}
          <div className="absolute top-2 right-2">
            <FavoriteButton
              slug={r.slug}
              name={r.name}
              initial={favorites.has(r.id)}
              variant="card"
              refresh={refreshOnFavorite}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group block h-full overflow-hidden rounded-xl bg-surface shadow-card transition active:scale-[0.99]"
    >
      <div className="aspect-[4/3] bg-accent-soft">
        {recipe.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- served via /img proxy
          <img
            src={`/img/${recipe.id}?size=min-original&v=${recipe.image}`}
            alt=""
            loading="lazy"
            className="size-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid size-full place-items-center text-4xl opacity-60">🍽️</div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <h2 className="line-clamp-2 font-serif text-[1.05rem] font-bold leading-snug">{recipe.name}</h2>
        <SourceCredit url={recipe.orgURL} compact />
      </div>
    </Link>
  );
}

export function GridSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy>
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-xl bg-surface shadow-card">
          <div className="aspect-[4/3] animate-pulse bg-accent-soft" />
          <div className="m-3 h-4 w-3/4 animate-pulse rounded bg-accent-soft" />
        </li>
      ))}
    </ul>
  );
}

/** "All recipes | ♥ My Recipes" switch at the top of both lists. */
export function ListTabs({ current }: { current: "all" | "mine" }) {
  const tab = (id: "all" | "mine", href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === id ? "page" : undefined}
      className={`rounded-lg py-2 text-center text-sm font-bold transition ${
        current === id ? "bg-surface shadow-sm" : "text-muted"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Recipe lists" className="mb-4 grid grid-cols-2 rounded-xl bg-accent-soft p-1">
      {tab("all", "/", "All recipes")}
      {tab("mine", "/my-recipes", "♥ My Recipes")}
    </nav>
  );
}
