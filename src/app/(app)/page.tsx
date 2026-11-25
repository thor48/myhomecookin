import Link from "next/link";
import { Suspense } from "react";
import { getFavoriteIds, listRecipes } from "@/lib/mealie";
import { withMealie } from "@/lib/session";
import { GridSkeleton, ListTabs, RecipeGrid } from "@/components/recipe-grid";

export default function RecipesPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <Suspense>
        <Welcome searchParams={searchParams} />
      </Suspense>
      <ListTabs current="all" />
      <Suspense fallback={<SearchBox />}>
        <SearchBoxWithQuery searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<GridSkeleton />}>
        <RecipeList searchParams={searchParams} />
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

async function RecipeList({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q)?.trim();
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const [data, favorites] = await withMealie((t) =>
    Promise.all([listRecipes(t, { search: q, page }), getFavoriteIds(t)]),
  );

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
      <RecipeGrid recipes={data.items} favorites={favorites} />
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
