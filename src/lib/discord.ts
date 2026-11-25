import "server-only";
import { SITE_NAME, sourceHost } from "./site";

/**
 * Discord channel alerts via webhooks (no bot needed).
 *
 * Webhook URLs are secrets (anyone with one can post to the channel): they
 * live only in environment variables, never in the repo.
 *   DISCORD_WEBHOOK_RECIPES — new recipe added
 */

const TERRACOTTA = 0xc17f59;

type Embed = {
  title: string;
  url?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
};

/** Post to a Discord webhook. Never throws and gives up after 4s: alerts must not break the app. */
async function post(webhook: string | undefined, embed: Embed, avatarOrigin?: string) {
  if (!webhook) return;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: SITE_NAME,
        avatar_url: avatarOrigin ? `${avatarOrigin}/icons/icon-192.png` : undefined,
        // Recipe names come from users and websites: never let them ping anyone.
        allowed_mentions: { parse: [] },
        embeds: [{ color: TERRACOTTA, timestamp: new Date().toISOString(), ...embed }],
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error(`Discord alert failed: ${res.status} ${await res.text()}`);
  } catch (e) {
    console.error("Discord alert failed:", e instanceof Error ? e.message : e);
  }
}

const METHOD_LABEL = { website: "🌐 From a website", photo: "📷 From a photo", typed: "✍️ Typed in" };

export function notifyNewRecipe(input: {
  name: string;
  slug: string;
  addedBy: string;
  method: keyof typeof METHOD_LABEL;
  siteOrigin: string;
  sourceUrl?: string | null;
  credit?: string | null;
}) {
  const host = sourceHost(input.sourceUrl);
  const from = [input.credit, host && input.sourceUrl ? `[${host}](${input.sourceUrl})` : null]
    .filter(Boolean)
    .join(" · ");
  return post(
    process.env.DISCORD_WEBHOOK_RECIPES,
    {
      title: `🍲 ${input.name}`.slice(0, 256),
      url: `${input.siteOrigin}/recipes/${encodeURIComponent(input.slug)}`,
      fields: [
        { name: "Added by", value: input.addedBy.slice(0, 1024), inline: true },
        { name: "How", value: METHOD_LABEL[input.method], inline: true },
        ...(from ? [{ name: "From", value: from.slice(0, 1024) }] : []),
      ],
      footer: { text: "New recipe" },
    },
    input.siteOrigin,
  );
}
