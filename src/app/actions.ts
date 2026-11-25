"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { notifyNewRecipe } from "@/lib/discord";
import {
  createFromUrl,
  createManual,
  findByOriginalUrl,
  login,
  MealieAuthError,
  cardAssets,
  createInvite,
  getRecipe,
  getSelf,
  MealieError,
  registerWithInvite,
  setRecipeImage,
  uploadCardPhoto,
} from "@/lib/mealie";
import {
  isSupportedImage,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  PhotoImportError,
  readRecipeFromPhotos,
  type RecipeDraft,
} from "@/lib/photo-import";
import { requireToken, SESSION_COOKIE } from "@/lib/session";

export type FormState = { error?: string; username?: string } | undefined;

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  // Only allow same-site paths, never "//evil.com".
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function message(e: unknown) {
  return e instanceof MealieError ? e.message : "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your email and password.", username };

  let token: string;
  try {
    token = await login(username, password);
  } catch (e) {
    return { error: message(e), username };
  }

  await startSession(token);
  redirect(safeNext(formData.get("next")));
}

async function startSession(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

// ---------------------------------------------------------------------------

export async function importFromUrlAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = String(formData.get("url") ?? "").trim();
  let url: URL;
  try {
    url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) throw new Error();
  } catch {
    return { error: "That doesn't look like a web address. Copy the link from your browser." };
  }

  const token = await requireToken();
  let slug: string;
  try {
    const existing = await findByOriginalUrl(token, url.href);
    if (existing) redirect(`/recipes/${existing.slug}?duplicate=1`);
    slug = await createFromUrl(token, url.href);
  } catch (e) {
    if (e instanceof MealieAuthError) redirect("/logout?expired=1");
    if (e instanceof MealieError) {
      return {
        error:
          e.status >= 500 || e.status === 400
            ? "Couldn't find a recipe on that page. Try another link, or type it in yourself."
            : e.message,
      };
    }
    throw e; // includes the redirect() above
  }
  const origin = await siteOrigin();
  after(async () => {
    try {
      const [recipe, self] = await Promise.all([getRecipe(token, slug), getSelf(token)]);
      await notifyNewRecipe({
        name: recipe.name,
        slug,
        addedBy: self.fullName || self.username,
        method: "website",
        siteOrigin: origin,
        sourceUrl: recipe.orgURL ?? url.href,
      });
    } catch (e) {
      console.error("New-recipe alert skipped:", e instanceof Error ? e.message : e);
    }
  });
  redirect(`/recipes/${slug}?added=1`);
}

// ---------------------------------------------------------------------------

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

export async function createManualAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const ingredients = lines(formData.get("ingredients"));
  const steps = lines(formData.get("steps"));
  const source = String(formData.get("source") ?? "").trim();
  const credit = String(formData.get("credit") ?? "").trim().slice(0, 200);
  const photos = formData
    .getAll("photo")
    .filter((p): p is File => p instanceof File && p.size > 0 && isSupportedImage(p.type));

  if (!name) return { error: "Give the recipe a name." };
  if (ingredients.length === 0) return { error: "Add at least one ingredient." };
  if (steps.length === 0) return { error: "Add at least one step." };
  if (source && !/^https?:\/\//.test(source)) {
    return { error: "The source link should start with http:// or https://" };
  }

  const token = await requireToken();
  let slug: string;
  try {
    slug = await createManual(token, {
      name,
      description: String(formData.get("description") ?? "").trim(),
      recipeYield: String(formData.get("yield") ?? "").trim(),
      totalTime: String(formData.get("time") ?? "").trim(),
      ingredients,
      steps,
      orgURL: source || undefined,
      sourceCredit: credit || undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
    });
  } catch (e) {
    if (e instanceof MealieAuthError) redirect("/logout?expired=1");
    return { error: message(e) };
  }

  // Keep every photo it was read from as the original card, and use the
  // first as the recipe's picture until someone adds a photo of the dish.
  // The recipe is already saved, so a failed upload shouldn't lose it.
  if (photos.length > 0) {
    try {
      await setRecipeImage(token, slug, photos[0], extensionOf(photos[0]));
      for (const [i, p] of photos.entries()) {
        await uploadCardPhoto(token, slug, p, extensionOf(p), i + 1);
      }
    } catch (e) {
      console.error("Saving recipe card photos failed:", e);
    }
  }
  const origin = await siteOrigin();
  after(async () => {
    try {
      const self = await getSelf(token);
      await notifyNewRecipe({
        name,
        slug,
        addedBy: self.fullName || self.username,
        method: photos.length > 0 ? "photo" : "typed",
        siteOrigin: origin,
        sourceUrl: source || null,
        credit: credit || null,
      });
    } catch (e) {
      console.error("New-recipe alert skipped:", e instanceof Error ? e.message : e);
    }
  });
  redirect(`/recipes/${slug}?added=1`);
}

// ---------------------------------------------------------------------------

export type PhotoReadResult = { error: string } | { draft: RecipeDraft };

/** Read a recipe from uploaded photos. Returns a draft to review; saves nothing. */
export async function readPhotosAction(formData: FormData): Promise<PhotoReadResult> {
  await requireToken(); // signed-in family only: every call costs money

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length === 0) return { error: "Add a photo of the recipe first." };
  if (photos.length > MAX_PHOTOS) return { error: `Use up to ${MAX_PHOTOS} photos.` };
  for (const p of photos) {
    if (!isSupportedImage(p.type)) return { error: "Photos need to be JPEG, PNG or WebP." };
    if (p.size > MAX_PHOTO_BYTES) return { error: "One of those photos is too large." };
  }

  try {
    const draft = await readRecipeFromPhotos(
      await Promise.all(
        photos.map(async (p) => ({ data: Buffer.from(await p.arrayBuffer()), mediaType: p.type })),
      ),
    );
    return { draft };
  } catch (e) {
    if (e instanceof PhotoImportError) return { error: e.message };
    console.error("Photo import failed:", e);
    return { error: "Something went wrong reading the photos. Please try again." };
  }
}

// ---------------------------------------------------------------------------

function extensionOf(file: File) {
  return file.type.split("/")[1].replace("jpeg", "jpg");
}

export type PhotoAddState = { error?: string; done?: number } | undefined;

/**
 * Add a photo to an existing recipe:
 *   kind "dish" → becomes the recipe's main picture
 *   kind "card" → kept with the original recipe card photos
 */
export async function addRecipePhotoAction(
  _prev: PhotoAddState,
  formData: FormData,
): Promise<PhotoAddState> {
  const slug = String(formData.get("slug") ?? "");
  const kind = formData.get("kind") === "card" ? "card" : "dish";
  const photo = formData.get("photo");
  if (!slug) return { error: "Something went wrong. Reload and try again." };
  if (!(photo instanceof File) || photo.size === 0) return { error: "Choose a photo first." };
  if (!isSupportedImage(photo.type)) return { error: "Photos need to be JPEG, PNG or WebP." };
  if (photo.size > MAX_PHOTO_BYTES) return { error: "That photo is too large." };

  const token = await requireToken();
  try {
    const recipe = await getRecipe(token, slug);
    if (kind === "dish") {
      await setRecipeImage(token, slug, photo, extensionOf(photo));
    } else {
      await uploadCardPhoto(token, slug, photo, extensionOf(photo), cardAssets(recipe).length + 1);
      // A recipe with no picture yet shows the card until a dish photo is added.
      if (!recipe.image) await setRecipeImage(token, slug, photo, extensionOf(photo));
    }
  } catch (e) {
    if (e instanceof MealieAuthError) redirect("/logout?expired=1");
    if (e instanceof MealieError && e.status === 403) {
      return { error: "You can't change this recipe. Ask whoever added it." };
    }
    return { error: message(e) };
  }
  return { done: Date.now() };
}

// ---------------------------------------------------------------------------
// Invites

/** This site's public address (e.g. https://myhomecookin.com), as the visitor reached it. */
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

export type InviteResult = { error: string } | { url: string; uses: number };

/** Create an invite link for 1–10 people to join the cookbook. */
export async function createInviteAction(uses: number): Promise<InviteResult> {
  const count = Math.min(10, Math.max(1, Math.round(Number(uses) || 1)));
  const token = await requireToken();
  try {
    const self = await getSelf(token);
    if (!self.canInvite && !self.admin) {
      return { error: "Your account can't invite people. Ask whoever runs the cookbook." };
    }
    const invite = await createInvite(token, count);
    return { url: `${await siteOrigin()}/join?token=${encodeURIComponent(invite.token)}`, uses: count };
  } catch (e) {
    if (e instanceof MealieAuthError) redirect("/logout?expired=1");
    return { error: message(e) };
  }
}

export type JoinState = { error?: string; name?: string; email?: string } | undefined;

/** Create an account from an invite link, then sign the new person in. */
export async function joinAction(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const inviteToken = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const keep = { name, email };

  if (!inviteToken) return { error: "This invite link is incomplete. Ask for a new one.", ...keep };
  if (!name) return { error: "Enter your name.", ...keep };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address.", ...keep };
  // Mealie itself accepts any length.
  if (password.length < 8) return { error: "Use a password of at least 8 characters.", ...keep };

  let token: string;
  try {
    await registerWithInvite({ inviteToken, fullName: name, email, password });
    token = await login(email, password);
  } catch (e) {
    if (e instanceof MealieError && e.status === 400) {
      return { error: "This invite link has expired or was already used. Ask for a new one.", ...keep };
    }
    if (e instanceof MealieError && e.status === 409) {
      return { error: "That email already has an account. Sign in instead.", ...keep };
    }
    return { error: message(e), ...keep };
  }
  await startSession(token);
  redirect("/?welcome=1");
}
