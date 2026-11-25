import Link from "next/link";
import { Suspense } from "react";
import { listRecipes, type RecipeSummary } from "@/lib/mealie";
import { withMealie } from "@/lib/session";
import { SourceCredit } from "@/components/source-credit";

export default function RecipesPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <Suspense>
        <Welcome searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<SearchBox />}>
        <SearchBoxWithQuery searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<GridSkeleton />}>
        <RecipeGrid searchParams={searchParams} />
      </Suspense>
    </>
  );
}

type SP = PageProps<"/">["searchParams"];

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function Welcome({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const deleted = one(sp.deleted);
  if (deleted) {
    return (
      <p className="mb-5 rounded-xl bg-accent-soft px-4 py-3 text-sm">
        Deleted &ldquo;{deleted}&rdquo;.
      </p>
    );
  }
  if (!sp.welcome) return null;
  return (
    <div className="mb-5 rounded-xl bg-accent-soft px-4 py-3">
      <p className="font-serif text-lg font-bold">Welcome to the family cookbook!</p>
      <p className="mt-0.5 text-sm">
        Have a look around, and add a recipe you love: from a website, a photo of a recipe card,
        or typed in.
      </p>
    </div>
  );
}

async function SearchBoxWithQuery({ searchParams }: { searchParams: SP }) {
  return <SearchBox q={one((await searchParams).q)} />;
}

function SearchBox({ q }: { q?: string }) {
  return (
    <form action="/" className="mb-5" role="search">
      <input
        key={q}
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Search recipes, ingredients…"
        aria-label="Search recipes"
        className="field"
      />
    </form>
  );
}

async function RecipeGrid({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q)?.trim();
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const data = await withMealie((t) => listRecipes(t, { search: q, page }));

  if (data.items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <p className="font-serif text-xl">
          {q ? `Nothing matches “${q}”.` : "The cookbook is empty."}
        </p>
        <p className="mt-2 text-muted">
          {q ? "Try a different word." : "Add the first recipe from a link or type one in."}
        </p>
        <Link href="/add" className="btn mt-6">
          + Add a recipe
        </Link>
      </div>
    );
  }

  const href = (p: number) => `/?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <p className="mb-3 text-sm text-muted">
        {data.total} {data.total === 1 ? "recipe" : "recipes"}
        {q ? ` matching “${q}”` : ""}
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.items.map((r) => (
          <li key={r.id}>
            <RecipeCard recipe={r} />
          </li>
        ))}
      </ul>
      {data.total_pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pages">
          {page > 1 && (
            <Link href={href(page - 1)} className="btn-quiet">
              ← Newer
            </Link>
          )}
          <span className="text-sm text-muted">
            Page {page} of {data.total_pages}
          </span>
          {page < data.total_pages && (
            <Link href={href(page + 1)} className="btn-quiet">
              Older →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group block overflow-hidden rounded-xl bg-surface shadow-card transition active:scale-[0.99]"
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

function GridSkeleton() {
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
