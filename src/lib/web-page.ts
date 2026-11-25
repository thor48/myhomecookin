import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

/**
 * Fetches a recipe web page (and its picture) on the server, for Claude to
 * read when Mealie's own scraper can't find a recipe.
 *
 * The server sits on the home network, so it only ever fetches public
 * addresses: never Mealie, the router or anything else inside. Each redirect
 * is checked the same way.
 */

const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 60_000; // ~15k tokens: plenty for any recipe page
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;
// Many recipe sites turn away requests that don't look like a browser.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

export class WebPageError extends Error {}

const PRIVATE = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3], // multicast and reserved, up to 255.255.255.255
] as const) {
  PRIVATE.addSubnet(net, bits, "ipv4");
}
for (const [net, bits] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  PRIVATE.addSubnet(net, bits, "ipv6");
}

function isPrivate(address: string) {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return PRIVATE.check(mapped, "ipv4");
  return PRIVATE.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

async function assertPublic(url: URL) {
  if (!/^https?:$/.test(url.protocol)) throw new WebPageError("Only web links can be read.");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new WebPageError("That link can't be read.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new WebPageError("Couldn't reach that website. Check the link.");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivate(a.address))) {
    throw new WebPageError("That link can't be read.");
  }
}

/** GET a public URL, following redirects by hand so each hop is checked. */
async function publicFetch(start: string, accept: string) {
  let url = new URL(start);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "en" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new WebPageError("That website didn't respond. Try again, or type it in.");
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      url = new URL(location, url);
      continue;
    }
    return { res, url };
  }
  throw new WebPageError("That link redirects too many times.");
}

/** Read a body up to `max` bytes; null if it's bigger. */
async function readCapped(res: Response, max: number) {
  const declared = Number(res.headers.get("content-length"));
  if (declared > max) {
    await res.body?.cancel();
    return null;
  }
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export type RecipePage = {
  /** The page's readable text, with any recipe data (JSON-LD) it carries. */
  text: string;
  /** The page's main picture, if it names one. */
  imageUrl: string | null;
};

export async function fetchRecipePage(url: string): Promise<RecipePage> {
  const { res, url: finalUrl } = await publicFetch(url, "text/html,application/xhtml+xml");
  if (!res.ok) {
    await res.body?.cancel();
    throw new WebPageError(
      res.status === 403 || res.status === 429
        ? "That website won't let us read it. Type the recipe in instead."
        : "That page didn't load. Check the link.",
    );
  }
  if (!/html|xml|text\/plain/i.test(res.headers.get("content-type") ?? "")) {
    await res.body?.cancel();
    throw new WebPageError("That link isn't a web page.");
  }
  const body = await readCapped(res, MAX_PAGE_BYTES);
  if (!body) throw new WebPageError("That page is too large to read.");
  const html = new TextDecoder().decode(body);

  const text = pageText(html).slice(0, MAX_TEXT_CHARS);
  if (text.length < 200) {
    throw new WebPageError("That page came back nearly empty. Type the recipe in instead.");
  }
  return { text, imageUrl: mainImage(html, finalUrl) };
}

/** The page's picture, for the recipe photo. Null if it's missing or not an image. */
export async function fetchPageImage(url: string): Promise<{ data: Blob; extension: string } | null> {
  try {
    const { res } = await publicFetch(url, "image/webp,image/jpeg,image/png");
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[type];
    if (!res.ok || !extension) {
      await res.body?.cancel();
      return null;
    }
    const body = await readCapped(res, MAX_IMAGE_BYTES);
    return body && body.byteLength > 0 ? { data: new Blob([body], { type }), extension } : null;
  } catch (e) {
    console.error("Recipe picture skipped:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  deg: "°",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

function decode(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Visible text, plus structured recipe data, in a form that's cheap to send. */
function pageText(html: string) {
  // Recipe data some sites embed even when Mealie can't use it.
  const data = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim())
    .filter((j) => /recipe/i.test(j))
    .join("\n");

  const visible = decode(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|iframe|head|nav|footer)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return data ? `Structured recipe data on the page:\n${data}\n\nPage text:\n${visible}` : visible;
}

function mainImage(html: string, base: URL) {
  const meta = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i"))?.[0]
      .match(/content=["']([^"']+)["']/i)?.[1];
  const found = meta("og:image") ?? meta("twitter:image");
  if (!found) return null;
  try {
    const url = new URL(decode(found), base);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
