// Recipe scraper utility
// Calls the Cloudflare function to fetch and parse recipe JSON-LD from URLs

const API_BASE = import.meta.env.VITE_API_URL || 'https://dak.bkemper.me';

export interface ScrapedRecipe {
  name: string;
  description: string;
  prepTime: string | null;
  cookTime: string | null;
  totalTime: string | null;
  yield: string | null;
  ingredients: string[];
  instructions: string[];
  nutrition: {
    calories?: string;
    protein?: string;
    fat?: string;
    carbs?: string;
  } | null;
  image: string | null;
}

export async function scrapeRecipe(url: string): Promise<ScrapedRecipe> {
  const response = await fetch(`${API_BASE}/api/recipe/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch recipe' }));
    throw new Error(error.error || 'Failed to fetch recipe');
  }

  return response.json();
}

export function formatRecipeAsMarkdown(recipe: ScrapedRecipe): string {
  const lines: string[] = [];

  // Title
  if (recipe.name) {
    lines.push(`# ${recipe.name}`);
    lines.push('');
  }

  // Description
  if (recipe.description) {
    lines.push(recipe.description);
    lines.push('');
  }

  // Time info
  const timeInfo: string[] = [];
  if (recipe.prepTime) timeInfo.push(`Prep: ${recipe.prepTime}`);
  if (recipe.cookTime) timeInfo.push(`Cook: ${recipe.cookTime}`);
  if (recipe.totalTime) timeInfo.push(`Total: ${recipe.totalTime}`);
  if (recipe.yield) timeInfo.push(`Servings: ${recipe.yield}`);

  if (timeInfo.length > 0) {
    lines.push(`*${timeInfo.join(' | ')}*`);
    lines.push('');
  }

  // Ingredients
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    lines.push('## Ingredients');
    lines.push('');
    for (const ingredient of recipe.ingredients) {
      // Clean up ingredient text (remove price info like "$0.22")
      const cleaned = ingredient.replace(/\s*\(\$[\d.]+\*?\)\s*/g, '').trim();
      lines.push(`- ${cleaned}`);
    }
    lines.push('');
  }

  // Instructions
  if (recipe.instructions && recipe.instructions.length > 0) {
    lines.push('## Instructions');
    lines.push('');
    for (let i = 0; i < recipe.instructions.length; i++) {
      const step = recipe.instructions[i];
      // Clean up HTML entities
      const cleaned = step
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&');
      lines.push(`${i + 1}. ${cleaned}`);
      lines.push('');
    }
  }

  // Nutrition (optional, keep it brief)
  if (recipe.nutrition) {
    const nutritionInfo: string[] = [];
    if (recipe.nutrition.calories) nutritionInfo.push(recipe.nutrition.calories);
    if (recipe.nutrition.protein) nutritionInfo.push(`${recipe.nutrition.protein} protein`);
    if (recipe.nutrition.carbs) nutritionInfo.push(`${recipe.nutrition.carbs} carbs`);
    if (recipe.nutrition.fat) nutritionInfo.push(`${recipe.nutrition.fat} fat`);

    if (nutritionInfo.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push(`*Nutrition: ${nutritionInfo.join(', ')}*`);
    }
  }

  return lines.join('\n');
}
