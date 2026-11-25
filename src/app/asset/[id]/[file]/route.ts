import { type NextRequest } from "next/server";
import { fetchRecipeAsset, MealieError } from "@/lib/mealie";
import { SESSION_COOKIE } from "@/lib/session";

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const IMAGE_FILE = /^[a-z0-9_-]+\.(jpe?g|png|webp|gif)$/i;

// GET /asset/<recipeId>/<fileName> — photos of the original recipe card.
// Mealie serves these without a login, so it must stay private; this route
// only hands them to signed-in users.
export async function GET(request: NextRequest, ctx: RouteContext<"/asset/[id]/[file]">) {
  const { id, file } = await ctx.params;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return new Response(null, { status: 401 });
  if (!UUID.test(id) || !IMAGE_FILE.test(file)) return new Response(null, { status: 400 });

  try {
    const upstream = await fetchRecipeAsset(token, id, file);
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
        // Asset file names never change content, so cache for a long time.
        "Cache-Control": "private, max-age=2592000, immutable",
      },
    });
  } catch (e) {
    const status = e instanceof MealieError ? e.status : 502;
    return new Response(null, { status: status === 401 ? 401 : 404 });
  }
}
