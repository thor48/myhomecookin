import { type NextRequest } from "next/server";
import { fetchMadeEntryImage, IMAGE_SIZES, MealieError, type ImageSize } from "@/lib/mealie";
import { SESSION_COOKIE } from "@/lib/session";

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

// GET /made-photo/<recipeId>/<entryId>?size=min-original
// Photos people add with "I made this". Mealie serves these without a login,
// so it stays private; this route only hands them to signed-in users.
export async function GET(request: NextRequest, ctx: RouteContext<"/made-photo/[recipeId]/[entryId]">) {
  const { recipeId, entryId } = await ctx.params;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return new Response(null, { status: 401 });
  if (!UUID.test(recipeId) || !UUID.test(entryId)) return new Response(null, { status: 400 });

  const requested = request.nextUrl.searchParams.get("size") ?? "min-original";
  const size: ImageSize = (IMAGE_SIZES as readonly string[]).includes(requested)
    ? (requested as ImageSize)
    : "min-original";
  try {
    const upstream = await fetchMadeEntryImage(token, recipeId, entryId, size);
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "image/webp",
        "Cache-Control": "private, max-age=2592000, immutable",
      },
    });
  } catch (e) {
    const status = e instanceof MealieError ? e.status : 502;
    return new Response(null, { status: status === 401 ? 401 : 404 });
  }
}
