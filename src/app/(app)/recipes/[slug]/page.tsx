import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import {
  cardAssets,
  describeYield,
  getFavoriteIds,
  getRecipe,
  MealieError,
  recipeAccess,
  type Recipe,
} from "@/lib/mealie";
import { currentUser, withMealie } from "@/lib/session";
import { FavoriteButton } from "@/components/favorite-button";
import { SourceCredit } from "@/components/source-credit";
import { CATEGORIES, CATEGORY_EMOJI, niceAmount, sourceCredit, type CategoryName } from "@/lib/site";
import { AddPhoto } from "./add-photo";
import { CardPhotos } from "./card-photos";
import { KitchenSection } from "./kitchen";
import { RecipeBody } from "./recipe-body";

type Props = PageProps<"/recipes/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = await loadRecipe((await params).slug);
  return { title: recipe.name, description: recipe.description ?? undefined };
}

export default function RecipePage({ params, searchParams }: Props) {
  return (
    <article className="mx-auto max-w-2xl">
      <Suspense fallback={<Breadcrumb />}>
        <BreadcrumbForRecipe params={params} />
      </Suspense>
      <Suspense>
        <Banner searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<RecipeSkeleton />}>
        <RecipeView params={params} />
      </Suspense>
    </article>
  );
}

/** "← All recipes › 🍽️ Dinner / Mains": each category opens the list filtered to it. */
function Breadcrumb({ categories = [] }: { categories?: { name: string; slug: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted">
        <li>
          <Link href="/" className="hover:text-foreground">
            ← All recipes
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.slug} className="flex items-center gap-1.5">
            <span aria-hidden>›</span>
            <Link href={`/?cat=${encodeURIComponent(c.slug)}`} className="font-bold text-link hover:underline">
              {CATEGORY_EMOJI[c.name as CategoryName] ? `${CATEGORY_EMOJI[c.name as CategoryName]} ` : ""}
              {c.name}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

async function BreadcrumbForRecipe({ params }: { params: Props["params"] }) {
  const recipe = await loadRecipe((await params).slug); // same request the page uses (cached)
  // App categories first, in their usual order; then any others the recipe has.
  const order = (n: string) => {
    const i = (CATEGORIES as readonly string[]).indexOf(n);
    return i === -1 ? CATEGORIES.length : i;
  };
  const categories = [...(recipe.recipeCategory ?? [])].sort((a, b) => order(a.name) - order(b.name));
  return <Breadcrumb categories={categories} />;
}

async function Banner({ searchParams }: { searchParams: Props["searchParams"] }) {
  const sp = await searchParams;
  const text = sp.duplicate
    ? "This recipe is already in the cookbook, so here it is."
    : sp.edited
      ? "Changes saved."
      : sp.added
      ? "Saved to the cookbook. Give it a quick look to check everything came through."
      : null;
  if (!text) return null;
  return <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm">{text}</p>;
}

// cache(): metadata and the page share one Mealie request per render.
const loadRecipe = cache(async (slug: string): Promise<Recipe> => {
  try {
    return await withMealie((t) => getRecipe(t, slug));
  } catch (e) {
    if (e instanceof MealieError && e.status === 404) notFound();
    throw e;
  }
});

async function RecipeView({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  const recipe = await loadRecipe(slug);
  const credit = sourceCredit(recipe.extras);
  const cards = cardAssets(recipe);
  const [self, favorites] = await Promise.all([currentUser(), withMealie(getFavoriteIds)]);
  const { canEdit } = recipeAccess(self, recipe);

  const meta = [
    describeYield(recipe) ?? ["", null],
    ["Total", recipe.totalTime],
    ["Prep", recipe.prepTime],
    ["Cook", recipe.cookTime ?? recipe.performTime],
  ].filter((m): m is [string, string] => Boolean(m?.[1]));

  return (
    <>
      {recipe.image && (
        // eslint-disable-next-line @next/next/no-img-element -- served via /img proxy
        <img
          src={`/img/${recipe.id}?size=original&v=${recipe.image}`}
          alt=""
          className="-mx-4 mb-5 aspect-[4/3] w-[calc(100%+2rem)] max-w-none object-cover sm:mx-0 sm:w-full sm:rounded-xl"
        />
      )}

      <h1 className="font-serif text-3xl leading-tight font-bold sm:text-4xl">{recipe.name}</h1>
      <div className="mt-2 flex items-start justify-between gap-3">
        <SourceCredit url={recipe.orgURL} credit={credit} />
        <div className="flex shrink-0 gap-2">
          <FavoriteButton slug={recipe.slug} name={recipe.name} initial={favorites.has(recipe.id)} />
          {canEdit && (
            <Link href={`/recipes/${recipe.slug}/edit`} className="btn-quiet shrink-0 px-3 py-1.5">
              ✏️ Edit
            </Link>
          )}
        </div>
      </div>
      {recipe.description && <p className="mt-4 text-lg leading-relaxed">{recipe.description}</p>}

      {meta.length > 0 && (
        <dl className="mt-5 flex flex-wrap gap-2">
          {meta.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-surface px-3 py-2">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <RecipeBody
        ingredients={recipe.recipeIngredient.map((i) => ({
          title: i.title || null,
          text: niceAmount((i.display || i.note || i.originalText || "").trim()),
        }))}
        steps={recipe.recipeInstructions.map((s) => ({ title: s.title || null, text: s.text }))}
      />

      {recipe.notes && recipe.notes.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-2xl font-semibold">Notes</h2>
          {recipe.notes.map((n, i) => (
            <div key={i} className="mb-3 rounded-xl bg-accent-soft p-4">
              {n.title && <h3 className="mb-1 font-medium">{n.title}</h3>}
              <p className="whitespace-pre-line">{n.text}</p>
            </div>
          ))}
        </section>
      )}

      <section className="mt-10">
        {cards.length > 0 && (
          <>
            <h2 className="mb-1 font-serif text-2xl font-semibold">Original recipe card</h2>
            <p className="mb-3 text-sm text-muted">Tap to see it full size.</p>
            <CardPhotos
              cards={cards.map((c) => ({ name: c.name, src: `/asset/${recipe.id}/${c.fileName}` }))}
            />
          </>
        )}
        <AddPhoto slug={recipe.slug} />
      </section>

      <Suspense fallback={<p className="mt-12 text-sm text-muted">Loading the kitchen log…</p>}>
        <KitchenSection recipe={recipe} self={self} />
      </Suspense>

      {recipe.orgURL && (
        <footer className="mt-12 border-t border-border pt-4">
          <SourceCredit url={recipe.orgURL} credit={credit} />
          <p className="mt-1 text-xs text-muted">
            Please visit the original — it&apos;s someone&apos;s hard work.
          </p>
        </footer>
      )}
    </>
  );
}

function RecipeSkeleton() {
  return (
    <div aria-busy className="space-y-4">
      <div className="aspect-[4/3] animate-pulse rounded-xl bg-accent-soft" />
      <div className="h-9 w-3/4 animate-pulse rounded bg-accent-soft" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-accent-soft" />
    </div>
  );
}
