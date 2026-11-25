export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "My Home Cookin'";

/** Label under the home-screen icon; phones cut off anything past ~12 characters. */
export const SITE_SHORT_NAME = process.env.NEXT_PUBLIC_SITE_SHORT_NAME ?? "Home Cookin'";

/** "https://www.seriouseats.com/x" → "seriouseats.com" */
export function sourceHost(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Text credit stored on a recipe, if any. */
export function sourceCredit(extras?: Record<string, unknown> | null): string | null {
  const v = extras?.source_credit;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
