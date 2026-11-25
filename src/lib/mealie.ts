import "server-only";

/**
 * Thin client for the Mealie REST API (written against Mealie v2.x).
 * Your instance documents every endpoint at  <MEALIE_URL>/docs.
 *
 * Every call runs on the Next.js server, so Mealie never has to be reachable
 * from the internet — only this app is.
 */

const MEALIE_URL = (process.env.MEALIE_URL ?? "http://localhost:9000").replace(/\/$/, "");

/** Mealie rejected the token (expired or revoked). Callers send the user to /logout. */
export class MealieAuthError extends Error {}

export class MealieError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Types (only the fields this app uses)
// ---------------------------------------------------------------------------

export type Tag = { id: string; name: string; slug: string };

export type RecipeSummary = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  image?: string | null;
  recipeYield?: string | null;
  recipeYieldQuantity?: number | null;
  recipeServings?: number | null;
  totalTime?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  performTime?: string | null;
  orgURL?: string | null;
  tags?: Tag[];
  recipeCategory?: Tag[];
  userId?: string;
  dateAdded?: string | null;
};

export type Ingredient = {
  title?: string | null;
  note?: string | null;
  display?: string | null;
  originalText?: string | null;
  quantity?: number | null;
  referenceId?: string;
};

export type Instruction = {
  id?: string;
  title?: string | null;
  text: string;
};

export type Recipe = RecipeSummary & {
  recipeIngredient: Ingredient[];
  recipeInstructions: Instruction[];
  notes?: { title: string; text: string }[];
  /** Free-form key/values. We keep a text credit ("Aunt Mary") in `source_credit`. */
  extras?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type Paginated<T> = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  items: T[];
};

export type MealieUser = {
  id: string;
  username: string;
  fullName?: string | null;
  email: string;
  admin?: boolean;
};

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

async function mealieFetch(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${MEALIE_URL}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new MealieError(
      `Can't reach Mealie at ${MEALIE_URL}. Is the container running, and is MEALIE_URL right?`,
      503,
    );
  }

  if (res.status === 401 && token) throw new MealieAuthError("Session expired");
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : (body?.detail?.message ?? detail);
    } catch {}
    throw new MealieError(detail || `Mealie returned ${res.status}`, res.status);
  }
  return res;
}

async function json<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  return (await mealieFetch(path, token, init)).json() as Promise<T>;
}

function jsonBody(body: unknown): RequestInit {
  return { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Exchange a Mealie username/email + password for an access token. */
export async function login(username: string, password: string): Promise<string> {
  const form = new URLSearchParams({ username, password, remember_me: "true" });
  try {
    const data = await json<{ access_token: string }>("/api/auth/token", null, {
      method: "POST",
      body: form,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return data.access_token;
  } catch (e) {
    if (e instanceof MealieError && (e.status === 401 || e.status === 400)) {
      throw new MealieError("That email or password didn't work.", 401);
    }
    throw e;
  }
}

export function getSelf(token: string) {
  return json<MealieUser>("/api/users/self", token);
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export function listRecipes(
  token: string,
  opts: { search?: string; page?: number; perPage?: number } = {},
) {
  const params = new URLSearchParams({
    page: String(opts.page ?? 1),
    perPage: String(opts.perPage ?? 24),
    orderBy: "created_at",
    orderDirection: "desc",
  });
  if (opts.search) params.set("search", opts.search);
  return json<Paginated<RecipeSummary>>(`/api/recipes?${params}`, token);
}

export function getRecipe(token: string, slug: string) {
  return json<Recipe>(`/api/recipes/${encodeURIComponent(slug)}`, token);
}

/**
 * Look for a recipe already imported from this URL. Best effort: if this
 * Mealie version doesn't support the filter, we just skip the check.
 */
export async function findByOriginalUrl(token: string, url: string) {
  const params = new URLSearchParams({
    page: "1",
    perPage: "1",
    queryFilter: `orgURL = "${url.replace(/"/g, '\\"')}"`,
  });
  try {
    const res = await json<Paginated<RecipeSummary>>(`/api/recipes?${params}`, token);
    return res.items.find((r) => r.orgURL === url) ?? null;
  } catch (e) {
    if (e instanceof MealieAuthError) throw e;
    return null;
  }
}

/** Have Mealie scrape a recipe page. Returns the new recipe's slug. */
export function createFromUrl(token: string, url: string) {
  return json<string>("/api/recipes/create/url", token, {
    method: "POST",
    ...jsonBody({ url, includeTags: true }),
  });
}

export type ManualRecipeInput = {
  name: string;
  description?: string;
  recipeYield?: string;
  totalTime?: string;
  ingredients: string[];
  steps: string[];
  orgURL?: string;
  /** Text credit for non-website sources: "Aunt Mary", "Joy of Cooking, p. 212". */
  sourceCredit?: string;
  notes?: string;
};

/** Create a recipe typed in by hand. Returns its slug. */
export async function createManual(token: string, input: ManualRecipeInput) {
  const slug = await json<string>("/api/recipes", token, {
    method: "POST",
    ...jsonBody({ name: input.name }),
  });

  // Mealie creates an empty recipe; fill it in with a full update.
  const recipe = await getRecipe(token, slug);
  const updated: Recipe = {
    ...recipe,
    description: input.description || null,
    recipeYield: input.recipeYield || null,
    totalTime: input.totalTime || null,
    orgURL: input.orgURL || null,
    extras: { ...(recipe.extras ?? {}), ...(input.sourceCredit ? { source_credit: input.sourceCredit } : {}) },
    notes: input.notes ? [{ title: "", text: input.notes }] : [],
    recipeIngredient: input.ingredients.map((line) => ({
      note: line,
      display: line,
      originalText: line,
      quantity: null,
      referenceId: crypto.randomUUID(),
    })),
    recipeInstructions: input.steps.map((text) => ({
      id: crypto.randomUUID(),
      title: "",
      text,
      ingredientReferences: [],
    })),
  };
  await mealieFetch(`/api/recipes/${encodeURIComponent(slug)}`, token, {
    method: "PUT",
    ...jsonBody(updated),
  });
  return slug;
}

/** "Serves 4" / "Makes 48 cookies" from Mealie's split yield fields. */
export function describeYield(r: RecipeSummary): [label: string, value: string] | null {
  const n = (x?: number | null) => (x && x > 0 ? String(+x.toFixed(2)) : "");
  const text = r.recipeYield?.trim() ?? "";
  if (n(r.recipeServings)) return ["Serves", n(r.recipeServings)];
  if (n(r.recipeYieldQuantity)) return ["Makes", `${n(r.recipeYieldQuantity)} ${text}`.trim()];
  return text ? ["Makes", text] : null;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** Set a recipe's photo (e.g. the recipe card it was read from). */
export async function setRecipeImage(token: string, slug: string, image: Blob, extension: string) {
  const form = new FormData();
  form.set("image", image, `image.${extension}`);
  form.set("extension", extension);
  await mealieFetch(`/api/recipes/${encodeURIComponent(slug)}/image`, token, {
    method: "PUT",
    body: form,
  });
}

export const IMAGE_SIZES = ["original", "min-original", "tiny-original"] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

/** Raw image response from Mealie, streamed back through /img/[id]. */
export function fetchRecipeImage(token: string, recipeId: string, size: ImageSize) {
  return mealieFetch(
    `/api/media/recipes/${encodeURIComponent(recipeId)}/images/${size}.webp`,
    token,
    { headers: { Accept: "image/webp,image/*" } },
  );
}
