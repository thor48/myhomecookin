import Link from "next/link";
import { Suspense } from "react";
import { ensureCategories, getFavoriteIds, listRecipes, madeCounts } from "@/lib/mealie";
import { CATEGORY_EMOJI, type CategoryName } from "@/lib/site";
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
      <Suspense fallback={<div className="mb-4 h-[8.5rem] sm:h-16" />}>
        <CategoryChips searchParams={searchParams} />
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

/** Category buttons: 3 across on phones (2 rows), one row on wider screens. No sideways scrolling. */
async function CategoryChips({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const current = one(sp.cat);
  const categories = await withMealie(ensureCategories);
  const href = (cat?: string) =>
    `/?${new URLSearchParams({
      ...(one(sp.q) ? { q: one(sp.q)! } : {}),
      ...(one(sp.sort) ? { sort: one(sp.sort)! } : {}),
      ...(cat ? { cat } : {}),
    })}`;
  const button = (key: string, emoji: string, label: string, active: boolean, to: string) => (
    <Link
      key={key}
      href={to}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-2 text-center text-[0.8rem] leading-tight transition active:scale-[0.97] ${
        active
          ? "border-accent bg-accent font-bold text-white shadow-card"
          : "border-border bg-surface text-foreground hover:border-terracotta"
      }`}
    >
      <span aria-hidden className="text-xl leading-none">
        {emoji}
      </span>
      <span>{label}</span>
    </Link>
  );
  return (
    <nav aria-label="Categories" className="mb-4 grid auto-rows-fr grid-cols-3 gap-2 sm:grid-cols-6">
      {button("all", "📖", "All", !current, href())}
      {categories.map((c) =>
        button(c.slug, CATEGORY_EMOJI[c.name as CategoryName] ?? "🍴", c.name, current === c.slug, href(c.slug)),
      )}
    </nav>
  );
}

async function SearchBoxWithQuery({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <SearchBox q={one(sp.q)} cat={one(sp.cat)} />;
}

function SearchBox({ q, cat }: { q?: string; cat?: string }) {
  return (
    <form action="/" className="mb-3" role="search">
      {cat && <input type="hidden" name="cat" value={cat} />}
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
  const cat = one(sp.cat);
  const page = byMade ? 1 : Math.max(1, Number(one(sp.page)) || 1);
  const [data, favorites, counts] = await withMealie((t) =>
    Promise.all([
      // "Most made" sorts the whole cookbook here, so fetch it all at once.
      listRecipes(t, byMade ? { search: q, category: cat, perPage: 1000 } : { search: q, category: cat, page }),
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
      <div className="rounded-xl border border-dashed border-border bg-background/85 px-6 py-16 text-center">
        <p className="font-serif text-xl">
          {q ? `Nothing matches “${q}”.` : cat ? "No recipes in this category yet." : "The cookbook is empty."}
        </p>
        <p className="mt-2 text-muted">
          {q
            ? "Try a different word."
            : cat
              ? "Pick a category when you add or edit a recipe and it will show up here."
              : "Add the first recipe from a link or type one in."}
        </p>
        <Link href="/add" className="btn mt-6">
          + Add a recipe
        </Link>
      </div>
    );
  }

  const keep = { ...(q ? { q } : {}), ...(cat ? { cat } : {}) };
  const href = (p: number) => `/?${new URLSearchParams({ ...keep, page: String(p) })}`;
  const sortHref = (made: boolean) => `/?${new URLSearchParams({ ...keep, ...(made ? { sort: "made" } : {}) })}`;

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
