import { Fragment, type ReactNode } from "react";

/**
 * A tiny, safe markdown renderer for recipe ingredients and steps.
 *
 * Supports **bold**, *italic* (also __bold__ / _italic_), `code`,
 * [links](https://…) and simple "- " / "1. " lists. Raw HTML is never
 * rendered (React escapes everything), and links only allow http(s),
 * mailto, tel and same-site paths. Text without markdown comes back as the
 * original string, so plain recipes render exactly as before.
 */

const INLINE = new RegExp(
  [
    /\\([\\`*_[\]()#+\-.!~>])/.source, // 1: escaped character
    /`([^`\n]+)`/.source, // 2: code
    /\[([^\]\n]+)\]\(([^()\s]+)\)/.source, // 3, 4: link
    /\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/.source, // 5: bold
    /(?<!\w)__(?=\S)([\s\S]+?)(?<=\S)__(?!\w)/.source, // 6: bold
    /\*(?=[^\s*])([\s\S]+?)(?<=[^\s*])\*/.source, // 7: italic
    /(?<!\w)_(?=[^\s_])([\s\S]+?)(?<=[^\s_])_(?!\w)/.source, // 8: italic
  ].join("|"),
  "g",
);

/** The link's href if it is safe to follow, else null. */
function safeHref(url: string): string | null {
  if (/^\/(?!\/)/.test(url)) return url; // same-site path
  try {
    const u = new URL(url);
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const push = (node: ReactNode) => {
    // Keep neighbouring text together, so plain text stays one string.
    if (typeof node === "string" && typeof out[out.length - 1] === "string") {
      out[out.length - 1] = (out[out.length - 1] as string) + node;
    } else out.push(node);
  };

  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index;
    if (at > last) push(text.slice(last, at));
    last = at + m[0].length;
    const key = out.length;

    if (m[1] !== undefined) push(m[1]);
    else if (m[2] !== undefined)
      push(
        <code key={key} className="rounded bg-accent-soft px-1 text-[0.9em]">
          {m[2]}
        </code>,
      );
    else if (m[3] !== undefined) {
      const href = safeHref(m[4]);
      if (!href) {
        push(m[3]);
        continue;
      }
      const external = !href.startsWith("/");
      push(
        <a
          key={key}
          href={href}
          className="text-link underline"
          {...(external && { target: "_blank", rel: "noopener noreferrer nofollow" })}
        >
          {inline(m[3])}
        </a>,
      );
    } else if (m[5] !== undefined || m[6] !== undefined)
      push(<strong key={key}>{inline(m[5] ?? m[6])}</strong>);
    else push(<em key={key}>{inline(m[7] ?? m[8])}</em>);
  }
  if (last < text.length) push(text.slice(last));
  return out;
}

/** One line of markdown (ingredients): inline styles and links only. */
export function MarkdownInline({ text }: { text: string }): ReactNode {
  const nodes = inline(text);
  return nodes.length === 1 && typeof nodes[0] === "string" ? text : <>{nodes}</>;
}

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBER = /^\s*(\d+)[.)]\s+(.*)$/;

type Block =
  | { kind: "text"; lines: string[] }
  | { kind: "ul" | "ol"; start: number; items: string[] };

/**
 * A step: inline markdown, plus lists of two or more "- " or "1. " lines.
 * (A single "1. Heat the oven" line stays as text, as it always has.)
 * Line breaks are kept by the parent's `whitespace-pre-line`.
 */
export function MarkdownBlock({ text }: { text: string }): ReactNode {
  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; ) {
    const kind = BULLET.test(lines[i]) ? "ul" : NUMBER.test(lines[i]) ? "ol" : null;
    const pattern = kind === "ul" ? BULLET : NUMBER;
    let j = i;
    while (kind && j < lines.length && pattern.test(lines[j])) j++;
    if (kind && j - i >= 2) {
      const matches = lines.slice(i, j).map((l) => l.match(pattern)!);
      blocks.push({
        kind,
        start: kind === "ol" ? Number(matches[0][1]) : 1,
        items: matches.map((mm) => mm[mm.length - 1]),
      });
      i = j;
    } else {
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === "text") prev.lines.push(lines[i]);
      else blocks.push({ kind: "text", lines: [lines[i]] });
      i++;
    }
  }

  if (blocks.length === 1 && blocks[0].kind === "text") return <MarkdownInline text={text} />;

  return blocks.map((b, i) => {
    if (b.kind === "text") {
      const body = b.lines.join("\n").trim();
      return body ? (
        <p key={i} className="my-1 first:mt-0 last:mb-0">
          <MarkdownInline text={body} />
        </p>
      ) : (
        <Fragment key={i} />
      );
    }
    const List = b.kind;
    return (
      <List
        key={i}
        start={b.kind === "ol" && b.start !== 1 ? b.start : undefined}
        className={`my-1 space-y-0.5 pl-5 first:mt-0 last:mb-0 ${b.kind === "ul" ? "list-disc" : "list-decimal"}`}
      >
        {b.items.map((item, k) => (
          <li key={k}>
            <MarkdownInline text={item} />
          </li>
        ))}
      </List>
    );
  });
}
