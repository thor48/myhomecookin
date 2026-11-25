import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

/**
 * Reads recipe photos (cards, cookbook pages, screenshots) with Claude and
 * returns a draft for the person to check before it's saved.
 *
 * Needs ANTHROPIC_API_KEY on the server. The browser never sees it.
 */

const MODEL = "claude-opus-5-5";

export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // Claude's per-image limit
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

export function photoImportEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const RecipeDraftSchema = z.object({
  found_recipe: z
    .boolean()
    .describe("false if the photos don't show a recipe (or are too blurry to read)"),
  name: z.string(),
  description: z.string().describe("Only if the source has one; otherwise empty"),
  servings: z.string().describe('As written, e.g. "8 slices" or "Serves 4"; empty if absent'),
  total_time: z.string().describe("As written; empty if absent"),
  ingredients: z.array(z.string()).describe("One line per ingredient, exactly as written"),
  steps: z.array(z.string()).describe("One entry per step, in order"),
  notes: z.string().describe("Tips, variations or margin notes; empty if none"),
  source_credit: z
    .string()
    .describe(
      'Who or where the recipe is from, as written: "From the kitchen of Aunt Mary", ' +
        'a cookbook title and page, a magazine. Empty if not shown.',
    ),
  unclear: z
    .array(z.string())
    .describe("Words or amounts you could not read with confidence, quoted as you read them"),
  continues_elsewhere: z
    .boolean()
    .describe(
      'true if the recipe clearly continues beyond these photos: an arrow at the end, "over", ' +
        '"cont.", or text cut off mid-step',
    ),
});

export type RecipeDraft = z.infer<typeof RecipeDraftSchema>;

const SYSTEM = `You transcribe recipes from photos for a family recipe collection.
The photos may show a handwritten recipe card, a cookbook or magazine page, a screenshot, or several pages of one recipe (for example the front and back of a card). Treat all photos as one recipe. Photos are often taken in a binder or on a counter, so other cards may be partly in frame: transcribe only the main recipe and ignore the rest.

Transcribe faithfully, so a family member can cook from it without the card:
- Keep every amount, ingredient and step as written. Never change a quantity, convert units, or invent anything that isn't there.
- Write cooking shorthand out clearly: "1#" → "1 lb", "2T." → "2 Tbsp", "1 t." → "1 tsp", "2 c." → "2 cups", "w/" → "with". Keep brand names ("Jimmy Dean").
- Fix obvious misspellings ("boulien" → "bouillon"), but keep the writer's own phrasing and voice.
- Handwriting can be hard to read: give your best reading, mark a doubtful word or amount with [?] in the text, and list it in "unclear". When a capital T (tablespoon) and lowercase t (teaspoon) can't be told apart, mark it.
- Printed card fields such as "From", "Serves" and "Cooking time" fill the matching fields; leave them empty when the line is blank.

Split ingredients one per line, without bullets. Split the method into separate steps, without numbering; if the source is one paragraph, break it at natural sentence boundaries.

Leave a field empty rather than guessing.`;

export class PhotoImportError extends Error {}

export type PhotoInput = { data: Buffer; mediaType: string };

export function isSupportedImage(type: string): type is MediaType {
  return (MEDIA_TYPES as readonly string[]).includes(type);
}

export async function readRecipeFromPhotos(photos: PhotoInput[]): Promise<RecipeDraft> {
  if (!photoImportEnabled()) {
    throw new PhotoImportError("Photo import isn't set up on this server yet.");
  }

  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // If Claude declines (rare false positives), retry on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(RecipeDraftSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            ...photos.map((p) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: p.mediaType as MediaType,
                data: p.data.toString("base64"),
              },
            })),
            {
              type: "text" as const,
              text:
                photos.length > 1
                  ? `Transcribe the recipe shown across these ${photos.length} photos.`
                  : "Transcribe the recipe in this photo.",
            },
          ],
        },
      ],
    });
  } catch (e) {
    console.error("Photo import request failed:", e instanceof Error ? e.message : e);
    if (e instanceof Anthropic.AuthenticationError) {
      throw new PhotoImportError("The AI key on the server isn't valid. Check ANTHROPIC_API_KEY.");
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new PhotoImportError("The photo reader is busy. Try again in a minute.");
    }
    if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) {
      // Account billing problem, not the photo; the server log has the details.
      throw new PhotoImportError(
        "Photo import is unavailable right now. Let whoever runs the cookbook know.",
      );
    }
    if (e instanceof Anthropic.BadRequestError) {
      throw new PhotoImportError("Couldn't read those photos. Try a clearer or smaller picture.");
    }
    if (e instanceof Anthropic.APIError || e instanceof Anthropic.APIConnectionError) {
      throw new PhotoImportError("The photo reader isn't responding. Try again shortly.");
    }
    throw e;
  }

  if (response.stop_reason === "refusal") {
    throw new PhotoImportError("Couldn't read a recipe from those photos. Try typing it in instead.");
  }
  const draft = response.parsed_output;
  if (!draft || response.stop_reason === "max_tokens") {
    throw new PhotoImportError("Couldn't make sense of those photos. Try again or type it in.");
  }
  if (!draft.found_recipe || (draft.ingredients.length === 0 && draft.steps.length === 0)) {
    throw new PhotoImportError(
      "No recipe found in those photos. Make sure the text is in focus and well lit.",
    );
  }
  return draft;
}
