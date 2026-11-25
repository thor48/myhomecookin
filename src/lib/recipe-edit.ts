import "server-only";
import { describeYield, type Recipe } from "./mealie";
import { niceAmount, sourceCredit } from "./site";

/** The text the edit form shows for each part of a recipe (also used to spot changes). */
export function editableText(recipe: Recipe) {
  return {
    name: recipe.name,
    description: recipe.description ?? "",
    yield: describeYield(recipe)?.[1] ?? "",
    time: recipe.totalTime ?? "",
    ingredients: recipe.recipeIngredient.map(ingredientText),
    steps: recipe.recipeInstructions.map((i) => i.text.trim()),
    notes: (recipe.notes ?? []).map((n) => (n.title ? `${n.title}: ${n.text}` : n.text)).join("\n\n"),
    credit: sourceCredit(recipe.extras) ?? "",
    source: recipe.orgURL ?? "",
  };
}

/** An ingredient as people see and edit it. */
export function ingredientText(i: Recipe["recipeIngredient"][number]) {
  return niceAmount((i.display || i.note || i.originalText || "").trim());
}

export type EditableText = ReturnType<typeof editableText>;
