import "server-only";
import { CATEGORIES } from "./site";

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

export type RecipeAsset = { name: string; icon: string; fileName: string };

export type Recipe = RecipeSummary & {
  recipeIngredient: Ingredient[];
  recipeInstructions: Instruction[];
  notes?: { title: string; text: string }[];
  /** When it was last made (Mealie's own field). */
  lastMade?: string | null;
  /** Free-form key/values. We keep a text credit ("Aunt Mary") in `source_credit`. */
  extras?: Record<string, unknown> | null;
  /** Files attached to the recipe. Card photos are named "Recipe card 1", "Recipe card 2"… */
  assets?: RecipeAsset[];
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
  /** Mealie permission to create invite links. */
  canInvite?: boolean;
};

/** A value quoted for a Mealie queryFilter. */
const quoted = (v: string) => `"${v.replace(/["\\]/g, "")}"`;

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
// Invites
// ---------------------------------------------------------------------------

export type Invite = { token: string; usesLeft: number };

/** Create an invite to the signed-in user's household. `uses` = how many people can join with it. */
export function createInvite(token: string, uses: number) {
  return json<Invite>("/api/households/invitations", token, {
    method: "POST",
    ...jsonBody({ uses }),
  });
}

/**
 * Create an account with an invite token. Works even with Mealie's public
 * sign-up turned off. Throws MealieError 400 (bad/used-up invite) or 409
 * (email already has an account).
 */
export async function registerWithInvite(input: {
  inviteToken: string;
  fullName: string;
  email: string;
  password: string;
}) {
  await mealieFetch("/api/users/register", null, {
    method: "POST",
    ...jsonBody({
      groupToken: input.inviteToken,
      fullName: input.fullName,
      email: input.email,
      // Family sign in with their email, so it doubles as the username.
      username: input.email,
      password: input.password,
      passwordConfirm: input.password,
      advanced: false,
      private: false,
      seedData: false,
      locale: "en-US",
    }),
  });
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export function listRecipes(
  token: string,
  opts: { search?: string; page?: number; perPage?: number; queryFilter?: string; category?: string } = {},
) {
  const params = new URLSearchParams({
    page: String(opts.page ?? 1),
    perPage: String(opts.perPage ?? 24),
    orderBy: "created_at",
    orderDirection: "desc",
  });
  if (opts.search) params.set("search", opts.search);
  if (opts.queryFilter) params.set("queryFilter", opts.queryFilter);
  if (opts.category) params.set("categories", opts.category);
  return json<Paginated<RecipeSummary>>(`/api/recipes?${params}`, token);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * The app's top-level categories as they exist in Mealie, in display order.
 * Missing ones are created (only works for accounts allowed to organize, e.g.
 * admins; for others the missing ones are just left out until an admin visits).
 */
export async function ensureCategories(token: string): Promise<Tag[]> {
  const list = async () =>
    (await json<Paginated<Tag>>("/api/organizers/categories?perPage=-1", token)).items;
  const existing = await list();
  const find = (name: string) => existing.find((c) => c.name.toLowerCase() === name.toLowerCase());
  for (const name of CATEGORIES.filter((n) => !find(n))) {
    try {
      // Use what Mealie returns: re-reading the list right away can miss new ones.
      existing.push(await json<Tag>("/api/organizers/categories", token, { method: "POST", ...jsonBody({ name }) }));
    } catch (e) {
      if (e instanceof MealieAuthError) throw e; // 403 (not allowed) or 409 (exists): fine
      if (e instanceof MealieError && e.status === 409) existing.push(...(await list()).filter((c) => !find(c.name)));
    }
  }
  return CATEGORIES.map(find).filter((c): c is Tag => Boolean(c));
}

/** Turn chosen category names into Mealie category objects (app categories only). */
export function pickCategories(all: Tag[], names: string[]) {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return all.filter((c) => wanted.has(c.name.toLowerCase())).map(({ id, name, slug }) => ({ id, name, slug }));
}

/** Set a recipe's app categories, keeping any other categories it already has. */
export async function setRecipeCategories(token: string, slug: string, names: string[]) {
  const [recipe, all] = await Promise.all([getRecipe(token, slug), ensureCategories(token)]);
  const ours = new Set(all.map((c) => c.id));
  const others = (recipe.recipeCategory ?? []).filter((c) => !ours.has(c.id));
  recipe.recipeCategory = [...others, ...pickCategories(all, names)];
  await updateRecipe(token, slug, recipe);
}

// ---------------------------------------------------------------------------
// Favorites (each person has their own)
// ---------------------------------------------------------------------------

/** IDs of the recipes the signed-in user has favorited. */
export async function getFavoriteIds(token: string): Promise<Set<string>> {
  const res = await json<{ ratings: { recipeId: string; isFavorite: boolean }[] }>(
    "/api/users/self/favorites",
    token,
  );
  return new Set(res.ratings.filter((r) => r.isFavorite).map((r) => r.recipeId));
}

export async function setFavorite(token: string, userId: string, slug: string, favorite: boolean) {
  await mealieFetch(
    `/api/users/${encodeURIComponent(userId)}/favorites/${encodeURIComponent(slug)}`,
    token,
    { method: favorite ? "POST" : "DELETE" },
  );
}


/** The user's favorite recipes, newest first. */
export async function listFavoriteRecipes(token: string) {
  const ids = [...(await getFavoriteIds(token))];
  if (ids.length === 0) return [];
  const res = await listRecipes(token, { perPage: 500, queryFilter: `id IN [${ids.map(quoted).join(",")}]` });
  return res.items;
}

/** Recipes a user added, newest first. */
export async function listRecipesAddedBy(token: string, userId: string) {
  const res = await listRecipes(token, { perPage: 500, queryFilter: `userId = ${quoted(userId)}` });
  return res.items;
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

/** Save a whole recipe. Renaming changes the slug, so use the returned recipe's slug. */
export function updateRecipe(token: string, slug: string, recipe: Recipe) {
  return json<Recipe>(`/api/recipes/${encodeURIComponent(slug)}`, token, {
    method: "PUT",
    ...jsonBody(recipe),
  });
}

/** Permanently delete a recipe (and its photos). */
export async function deleteRecipe(token: string, slug: string) {
  await mealieFetch(`/api/recipes/${encodeURIComponent(slug)}`, token, { method: "DELETE" });
}

/**
 * Who may change a recipe. The app enforces this itself; Mealie on its own
 * lets anyone in the household edit any recipe.
 *   - admins: edit and delete any recipe
 *   - everyone else: edit recipes they added
 */
export function recipeAccess(self: MealieUser, recipe: Pick<RecipeSummary, "userId">) {
  const admin = Boolean(self.admin);
  return { canEdit: admin || recipe.userId === self.id, canDelete: admin };
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
  categories?: Tag[];
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
    recipeCategory: input.categories ?? recipe.recipeCategory ?? [],
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
// From the kitchen: "I made this" entries (Mealie timeline) and comments
// ---------------------------------------------------------------------------

/** A "made it" entry. Mealie's own automatic events ("Recipe Created") are type "system" and skipped. */
export type MadeEntry = {
  id: string;
  recipeId: string;
  userId: string;
  subject: string;
  eventMessage: string | null;
  image: "has image" | "does not have image" | null;
  timestamp: string;
};

export type RecipeComment = {
  id: string;
  recipeId: string;
  text: string;
  createdAt: string;
  userId: string;
  user: { id: string; fullName?: string | null; username?: string | null };
};

const MADE_TYPE = "info";

export async function listMadeEntries(token: string, recipeId: string) {
  const params = new URLSearchParams({
    perPage: "200",
    orderBy: "timestamp",
    orderDirection: "desc",
    queryFilter: `recipeId = ${quoted(recipeId)} AND eventType = "${MADE_TYPE}"`,
  });
  return (await json<Paginated<MadeEntry>>(`/api/recipes/timeline/events?${params}`, token)).items;
}

/** How many times each recipe has been made, across the whole cookbook. */
export async function madeCounts(token: string): Promise<Map<string, number>> {
  const params = new URLSearchParams({ perPage: "5000", queryFilter: `eventType = "${MADE_TYPE}"` });
  const res = await json<Paginated<MadeEntry>>(`/api/recipes/timeline/events?${params}`, token);
  const counts = new Map<string, number>();
  for (const e of res.items) counts.set(e.recipeId, (counts.get(e.recipeId) ?? 0) + 1);
  return counts;
}

export function getMadeEntry(token: string, id: string) {
  return json<MadeEntry>(`/api/recipes/timeline/events/${encodeURIComponent(id)}`, token);
}

export function addMadeEntry(
  token: string,
  input: { recipeId: string; subject: string; note: string; timestamp: string; hasImage: boolean },
) {
  return json<MadeEntry>("/api/recipes/timeline/events", token, {
    method: "POST",
    ...jsonBody({
      recipeId: input.recipeId,
      subject: input.subject,
      eventType: MADE_TYPE,
      eventMessage: input.note || null,
      image: input.hasImage ? "has image" : "does not have image",
      timestamp: input.timestamp,
    }),
  });
}

export async function updateMadeEntryNote(token: string, entry: MadeEntry, note: string) {
  await mealieFetch(`/api/recipes/timeline/events/${encodeURIComponent(entry.id)}`, token, {
    method: "PUT",
    ...jsonBody({ subject: entry.subject, eventMessage: note || null, image: entry.image }),
  });
}

export async function deleteMadeEntry(token: string, id: string) {
  await mealieFetch(`/api/recipes/timeline/events/${encodeURIComponent(id)}`, token, { method: "DELETE" });
}

export async function setMadeEntryImage(token: string, id: string, image: Blob, extension: string) {
  const form = new FormData();
  form.set("image", image, `photo.${extension}`);
  form.set("extension", extension);
  await mealieFetch(`/api/recipes/timeline/events/${encodeURIComponent(id)}/image`, token, {
    method: "PUT",
    body: form,
  });
}

/** Raw photo for a "made it" entry, streamed back through /made-photo/[recipeId]/[entryId]. */
export function fetchMadeEntryImage(token: string, recipeId: string, entryId: string, size: ImageSize) {
  return mealieFetch(
    `/api/media/recipes/${encodeURIComponent(recipeId)}/images/timeline/${encodeURIComponent(entryId)}/${size}.webp`,
    token,
    { headers: { Accept: "image/webp,image/*" } },
  );
}

/** Mealie's "last made" date on the recipe (shown in Mealie's own UI too). */
export async function setLastMade(token: string, slug: string, timestamp: string) {
  await mealieFetch(`/api/recipes/${encodeURIComponent(slug)}/last-made`, token, {
    method: "PATCH",
    ...jsonBody({ timestamp }),
  });
}

export function listComments(token: string, slug: string) {
  return json<RecipeComment[]>(`/api/recipes/${encodeURIComponent(slug)}/comments`, token);
}

export function getComment(token: string, id: string) {
  return json<RecipeComment>(`/api/comments/${encodeURIComponent(id)}`, token);
}

export function addComment(token: string, recipeId: string, text: string) {
  return json<RecipeComment>("/api/comments", token, { method: "POST", ...jsonBody({ recipeId, text }) });
}

export async function updateComment(token: string, id: string, text: string) {
  await mealieFetch(`/api/comments/${encodeURIComponent(id)}`, token, { method: "PUT", ...jsonBody({ id, text }) });
}

export async function deleteComment(token: string, id: string) {
  await mealieFetch(`/api/comments/${encodeURIComponent(id)}`, token, { method: "DELETE" });
}

/**
 * Names of everyone in the household, by user id. Only admins may read this
 * list in Mealie; for everyone else it's empty and callers fall back to the
 * name saved on each entry ("Linda made this").
 */
export async function memberNames(token: string): Promise<Map<string, string>> {
  try {
    const res = await json<Paginated<{ id: string; fullName?: string | null; username?: string | null }>>(
      "/api/households/members?perPage=-1",
      token,
    );
    return new Map(res.items.map((m) => [m.id, m.fullName || m.username || "Someone"]));
  } catch (e) {
    if (e instanceof MealieAuthError) throw e;
    return new Map();
  }
}

/** Who may change a kitchen entry or comment: the person who wrote it, or an admin. */
export function entryAccess(self: MealieUser, authorId: string) {
  return { canChange: Boolean(self.admin) || self.id === authorId };
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

// Photos of the original recipe card are stored as recipe assets.
const CARD_PREFIX = "Recipe card";

export function cardAssets(recipe: Recipe): RecipeAsset[] {
  return (recipe.assets ?? [])
    .filter((a) => a.name.startsWith(CARD_PREFIX))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** Attach a photo of the original card. `number` makes the name "Recipe card <number>". */
export function uploadCardPhoto(token: string, slug: string, photo: Blob, extension: string, number: number) {
  const form = new FormData();
  form.set("name", `${CARD_PREFIX} ${number}`);
  form.set("icon", "mdi-file-image");
  form.set("extension", extension);
  form.set("file", photo, `card.${extension}`);
  return json<RecipeAsset>(`/api/recipes/${encodeURIComponent(slug)}/assets`, token, {
    method: "POST",
    body: form,
  });
}

/** Raw asset file from Mealie, streamed back through /asset/[id]/[file]. */
export function fetchRecipeAsset(token: string, recipeId: string, fileName: string) {
  return mealieFetch(
    `/api/media/recipes/${encodeURIComponent(recipeId)}/assets/${encodeURIComponent(fileName)}`,
    token,
    { headers: { Accept: "image/*" } },
  );
}

/** Raw image response from Mealie, streamed back through /img/[id]. */
export function fetchRecipeImage(token: string, recipeId: string, size: ImageSize) {
  return mealieFetch(
    `/api/media/recipes/${encodeURIComponent(recipeId)}/images/${size}.webp`,
    token,
    { headers: { Accept: "image/webp,image/*" } },
  );
}
