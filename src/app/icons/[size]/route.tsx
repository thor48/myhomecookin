import { appIcon } from "@/lib/app-icon";

// /icons/192, /icons/512, /icons/512-maskable — referenced from manifest.ts
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size } = await ctx.params;
  const [px, variant] = size.split("-");
  const n = Number(px);
  if (![192, 512].includes(n)) return new Response(null, { status: 404 });
  return appIcon(n, { maskable: variant === "maskable" });
}
