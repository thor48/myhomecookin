"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createFromUrl,
  createManual,
  findByOriginalUrl,
  login,
  MealieAuthError,
  MealieError,
  setRecipeImage,
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

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(safeNext(formData.get("next")));
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
  const photo = formData.get("photo");

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

  // The photo it was read from becomes the recipe's picture. The recipe is
  // already saved, so a failed upload shouldn't lose it.
  if (photo instanceof File && photo.size > 0 && isSupportedImage(photo.type)) {
    try {
      await setRecipeImage(token, slug, photo, photo.type.split("/")[1].replace("jpeg", "jpg"));
    } catch (e) {
      console.error("Saving recipe photo failed:", e);
    }
  }
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
