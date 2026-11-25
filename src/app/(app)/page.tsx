import Link from "next/link";
import { Suspense } from "react";
import { getFavoriteIds, listRecipes, madeCounts } from "@/lib/mealie";
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
  const byMade = one(sp.sort) === "made";
  const page = byMade ? 1 : Math.max(1, Number(one(sp.page)) || 1);
  const [data, favorites, counts] = await withMealie((t) =>
    Promise.all([
      // "Most made" sorts the whole cookbook here, so fetch it all at once.
      listRecipes(t, byMade ? { search: q, perPage: 1000 } : { search: q, page }),
      getFavoriteIds(t),
      madeCounts(t),
    ]),
  );
  if (byMade) {
    data.items.sort(
      (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name),
    );
    data.total_pages = 1;
  }

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
  const sortHref = (made: boolean) =>
    `/?${new URLSearchParams({ ...(q ? { q } : {}), ...(made ? { sort: "made" } : {}) })}`;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <p className="text-muted">
          {data.total} {data.total === 1 ? "recipe" : "recipes"}
          {q ? ` matching “${q}”` : ""}
        </p>
        <nav aria-label="Sort" className="flex shrink-0 gap-3">
          <Link href={sortHref(false)} className={byMade ? "text-muted" : "font-bold text-link"}>
            Newest
          </Link>
          <Link href={sortHref(true)} className={byMade ? "font-bold text-link" : "text-muted"}>
            🍳 Most made
          </Link>
        </nav>
      </div>
      <RecipeGrid recipes={data.items} favorites={favorites} madeCounts={counts} />
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
