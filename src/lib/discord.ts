import "server-only";
import { SITE_NAME, sourceHost } from "./site";

/**
 * Discord channel alerts via webhooks (no bot needed).
 *
 * Webhook URLs are secrets (anyone with one can post to the channel): they
 * live only in environment variables, never in the repo.
 *   DISCORD_WEBHOOK_RECIPES — new recipe added
 *   DISCORD_WEBHOOK_ACCOUNT — someone asked to join / a request was approved /
 *                             a cook sent a bug or idea from the Contact knife
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

export function accountAlertsEnabled() {
  return Boolean(process.env.DISCORD_WEBHOOK_ACCOUNT);
}

/** Post to a Discord webhook. Never throws and gives up after 4s: alerts must not break the app. */
async function post(webhook: string | undefined, embed: Embed, avatarOrigin?: string): Promise<boolean> {
  if (!webhook) return false;
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
    return res.ok;
  } catch (e) {
    console.error("Discord alert failed:", e instanceof Error ? e.message : e);
    return false;
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

/** Someone filled in "Ask to join". Returns whether Discord accepted it. */
export function notifyJoinRequest(input: {
  name: string;
  email: string;
  howTheyKnowUs: string;
  reviewUrl: string;
  siteOrigin: string;
}) {
  return post(
    process.env.DISCORD_WEBHOOK_ACCOUNT,
    {
      title: `🙋 ${input.name} would like to join`.slice(0, 256),
      url: input.reviewUrl,
      description: `**[Review and approve →](${input.reviewUrl})**`,
      fields: [
        { name: "Name", value: input.name.slice(0, 1024), inline: true },
        { name: "Email", value: input.email.slice(0, 1024), inline: true },
        { name: "How they know us", value: (input.howTheyKnowUs || "—").slice(0, 1024) },
      ],
      footer: { text: "Join request" },
    },
    input.siteOrigin,
  );
}

/** An admin approved a request and made the invite. */
export function notifyRequestApproved(input: { name: string; approvedBy: string; siteOrigin: string }) {
  return post(
    process.env.DISCORD_WEBHOOK_ACCOUNT,
    {
      title: `✅ ${input.name} approved`.slice(0, 256),
      description: `Invite made by ${input.approvedBy}.`.slice(0, 4096),
      color: 0x8a9a7b, // sage
      footer: { text: "Join request" },
    },
    input.siteOrigin,
  );
}

const FEEDBACK_KIND = {
  bug: { title: "🐞 Bug report", color: 0xd97b6c }, // soft coral
  idea: { title: "💡 Idea", color: 0x8a9a7b }, // sage
} as const;
export type FeedbackKind = keyof typeof FEEDBACK_KIND;

/** A signed-in cook sent a bug or idea from the Contact knife. Returns whether Discord accepted it. */
export function notifyFeedback(input: {
  kind: FeedbackKind;
  message: string;
  name: string;
  email: string;
  page: string;
  siteOrigin: string;
}) {
  const kind = FEEDBACK_KIND[input.kind];
  return post(
    process.env.DISCORD_WEBHOOK_ACCOUNT,
    {
      title: `${kind.title} from ${input.name}`.slice(0, 256),
      description: input.message.slice(0, 4096),
      color: kind.color,
      fields: [
        { name: "From", value: input.name.slice(0, 1024), inline: true },
        { name: "Email", value: input.email.slice(0, 1024), inline: true },
        { name: "Page", value: `${input.siteOrigin}${input.page}`.slice(0, 1024) },
      ],
      footer: { text: "Contact form" },
    },
    input.siteOrigin,
  );
}
