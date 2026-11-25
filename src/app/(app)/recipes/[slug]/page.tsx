import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { cardAssets, describeYield, getRecipe, MealieError, type Recipe } from "@/lib/mealie";
import { withMealie } from "@/lib/session";
import { SourceCredit } from "@/components/source-credit";
import { sourceCredit } from "@/lib/site";
import { AddPhoto } from "./add-photo";
import { CardPhotos } from "./card-photos";
import { RecipeBody } from "./recipe-body";

type Props = PageProps<"/recipes/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = await loadRecipe((await params).slug);
  return { title: recipe.name, description: recipe.description ?? undefined };
}

export default function RecipePage({ params, searchParams }: Props) {
  return (
    <article className="mx-auto max-w-2xl">
      <Link href="/" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        ← All recipes
      </Link>
      <Suspense>
        <Banner searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<RecipeSkeleton />}>
        <RecipeView params={params} />
      </Suspense>
    </article>
  );
}

async function Banner({ searchParams }: { searchParams: Props["searchParams"] }) {
  const sp = await searchParams;
  const text = sp.duplicate
    ? "This recipe is already in the cookbook, so here it is."
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
          className="-mx-4 mb-5 aspect-[4/3] w-[calc(100%+2rem)] max-w-none object-cover sm:mx-0 sm:w-full sm:rounded-2xl"
        />
      )}

      <h1 className="font-serif text-3xl leading-tight font-semibold sm:text-4xl">{recipe.name}</h1>
      <div className="mt-2">
        <SourceCredit url={recipe.orgURL} credit={credit} />
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
          text: (i.display || i.note || i.originalText || "").trim(),
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
      <div className="aspect-[4/3] animate-pulse rounded-2xl bg-accent-soft" />
      <div className="h-9 w-3/4 animate-pulse rounded bg-accent-soft" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-accent-soft" />
    </div>
  );
}
