import { type NextRequest } from "next/server";
import { fetchRecipeImage, IMAGE_SIZES, MealieError, type ImageSize } from "@/lib/mealie";
import { SESSION_COOKIE } from "@/lib/session";

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

// GET /img/<recipeId>?size=min-original
// Streams recipe photos from Mealie, which stays private on your network.
export async function GET(request: NextRequest, ctx: RouteContext<"/img/[id]">) {
  const { id } = await ctx.params;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return new Response(null, { status: 401 });
  if (!UUID.test(id)) return new Response(null, { status: 400 });

  const requested = request.nextUrl.searchParams.get("size") ?? "min-original";
  const size: ImageSize = (IMAGE_SIZES as readonly string[]).includes(requested)
    ? (requested as ImageSize)
    : "min-original";

  try {
    const upstream = await fetchRecipeImage(token, id, size);
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "image/webp",
        // Private: only the signed-in browser caches it.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    const status = e instanceof MealieError ? e.status : 502;
    return new Response(null, { status: status === 401 ? 401 : 404 });
  }
}
