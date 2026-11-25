import {
  entryAccess,
  listComments,
  listMadeEntries,
  memberNames,
  type MealieUser,
  type Recipe,
} from "@/lib/mealie";
import { withMealie } from "@/lib/session";
import { KitchenComposer, KitchenFeed, type FeedItem } from "./kitchen-client";

// Mealie stores comment times in UTC, sometimes without the "Z".
const asUtc = (t: string) => (/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`);
// Fixed time zone so the server and browser agree on the day shown.
const day = (iso: string) =>
  new Date(asUtc(iso)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/**
 * "From the kitchen": who made this recipe (with notes and photos) and
 * comments, newest first. Only "made it" entries count toward popularity.
 */
export async function KitchenSection({ recipe, self }: { recipe: Recipe; self: MealieUser }) {
  const [made, comments, names] = await withMealie((t) =>
    Promise.all([listMadeEntries(t, recipe.id), listComments(t, recipe.slug), memberNames(t)]),
  );

  const items: FeedItem[] = [
    ...made.map((e) => ({
      kind: "made" as const,
      id: e.id,
      author: names.get(e.userId) ?? e.subject.replace(/ made this$/, ""),
      when: day(e.timestamp),
      localIso: null,
      sortKey: Date.parse(asUtc(e.timestamp)),
      text: e.eventMessage ?? "",
      photo: e.image === "has image" ? `/made-photo/${recipe.id}/${e.id}` : null,
      canChange: entryAccess(self, e.userId).canChange,
    })),
    ...comments.map((c) => ({
      kind: "comment" as const,
      id: c.id,
      author: c.user?.fullName || c.user?.username || names.get(c.userId) || "Someone",
      when: day(c.createdAt),
      // Comments are real moments: shown in the viewer's own time zone.
      localIso: asUtc(c.createdAt),
      sortKey: Date.parse(asUtc(c.createdAt)),
      text: c.text,
      photo: null,
      canChange: entryAccess(self, c.userId).canChange,
    })),
  ].sort((a, b) => b.sortKey - a.sortKey);

  const last = made[0];
  const summary = made.length
    ? `Made ${made.length} ${made.length === 1 ? "time" : "times"} · last by ${
        names.get(last.userId) ?? last.subject.replace(/ made this$/, "")
      } on ${day(last.timestamp)}`
    : "Nobody has logged making this yet.";

  return (
    <section className="mt-12 border-t border-border pt-8" aria-labelledby="kitchen">
      <h2 id="kitchen" className="font-serif text-2xl font-bold">
        🍳 From the kitchen
      </h2>
      <p className="mt-1 text-sm text-muted">{summary}</p>
      <KitchenComposer slug={recipe.slug} recipeId={recipe.id} />
      <KitchenFeed items={items} />
    </section>
  );
}
