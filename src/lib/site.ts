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

const FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"],
  [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"],
];

/**
 * Mealie stores imported amounts as decimals ("2.3333332538605 cups"). Show a
 * leading decimal amount as a kitchen fraction instead: "2⅓ cups", "¼ teaspoon".
 * Anything that isn't close to a common fraction is rounded to 2 places.
 */
export function niceAmount(text: string): string {
  return text.replace(/^(\d+)?\.(\d+)(?=\s|$)/, (match) => {
    const value = Number(match);
    const whole = Math.floor(value);
    const part = value - whole;
    const hit = FRACTIONS.find(([f]) => Math.abs(part - f) < 0.02);
    if (hit) return `${whole || ""}${hit[1]}`;
    if (part < 0.02) return String(whole);
    if (part > 0.98) return String(whole + 1);
    return String(Math.round(value * 100) / 100);
  });
}
