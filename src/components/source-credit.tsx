import { sourceHost } from "@/lib/site";

/**
 * Credits where a recipe came from:
 *   website → "Adapted from seriouseats.com ↗" (a backlink)
 *   person or book → "From Aunt Mary" / "From Joy of Cooking, p. 212"
 */
export function SourceCredit({
  url,
  credit,
  compact = false,
}: {
  url?: string | null;
  credit?: string | null;
  compact?: boolean;
}) {
  const host = sourceHost(url);
  // Cards often already say "From the kitchen of…"; don't double the "From".
  const who = credit ? credit.replace(/^from\s+/i, "") : null;
  if (!host && !who) return null;

  if (compact) {
    return <span className="truncate text-xs text-muted">from {host ?? who}</span>;
  }

  return (
    <p className="text-sm text-muted">
      {who && (
        <>
          From <span className="font-script text-xl leading-none text-foreground">{who}</span>
          {host && " · "}
        </>
      )}
      {host && url && (
        <>
          {who ? "adapted from " : "Adapted from "}
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="font-bold text-link underline decoration-terracotta/50 underline-offset-2 hover:decoration-link"
          >
            {host}
          </a>{" "}
          <span aria-hidden>↗</span>
        </>
      )}
    </p>
  );
}
