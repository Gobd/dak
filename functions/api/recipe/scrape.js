// Cloudflare Pages Function for scraping recipe JSON-LD from URLs
import { getCorsHeaders, handleOptions } from '../_cors.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const { url } = await request.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'url required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch: ${response.status}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const html = await response.text();

    // Extract JSON-LD scripts
    const jsonLdMatches = html.match(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    );

    if (!jsonLdMatches) {
      return new Response(JSON.stringify({ error: 'No JSON-LD found on page' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Find Recipe schema
    let recipe = null;

    for (const match of jsonLdMatches) {
      const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '').trim();

      try {
        const data = JSON.parse(jsonContent);

        // Check if it's directly a Recipe
        if (data['@type'] === 'Recipe') {
          recipe = data;
          break;
        }

        // Check in @graph array
        if (data['@graph'] && Array.isArray(data['@graph'])) {
          const found = data['@graph'].find((item) => item['@type'] === 'Recipe');
          if (found) {
            recipe = found;
            break;
          }
        }
      } catch {
        // Invalid JSON, continue to next match
      }
    }

    if (!recipe) {
      return new Response(JSON.stringify({ error: 'No Recipe schema found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Format the recipe data
    const formatDuration = (iso) => {
      if (!iso) return null;
      const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      if (!match) return iso;
      const hours = match[1] ? parseInt(match[1]) : 0;
      const mins = match[2] ? parseInt(match[2]) : 0;
      if (hours && mins) return `${hours}h ${mins}m`;
      if (hours) return `${hours}h`;
      if (mins) return `${mins}m`;
      return iso;
    };

    const formatInstructions = (instructions) => {
      if (!instructions) return [];
      if (typeof instructions === 'string') return [instructions];
      if (Array.isArray(instructions)) {
        return instructions.map((step) => {
          if (typeof step === 'string') return step;
          if (step.text) return step.text;
          if (step['@type'] === 'HowToStep') return step.text || step.name || '';
          return String(step);
        });
      }
      return [];
    };

    const result = {
      name: recipe.name || '',
      description: recipe.description || '',
      prepTime: formatDuration(recipe.prepTime),
      cookTime: formatDuration(recipe.cookTime),
      totalTime: formatDuration(recipe.totalTime),
      yield: Array.isArray(recipe.recipeYield)
        ? recipe.recipeYield.find((y) => typeof y === 'string' && y.includes('serving')) ||
          recipe.recipeYield[0]
        : recipe.recipeYield,
      ingredients: recipe.recipeIngredient || [],
      instructions: formatInstructions(recipe.recipeInstructions),
      nutrition: recipe.nutrition
        ? {
            calories: recipe.nutrition.calories,
            protein: recipe.nutrition.proteinContent,
            fat: recipe.nutrition.fatContent,
            carbs: recipe.nutrition.carbohydrateContent,
          }
        : null,
      image: Array.isArray(recipe.image) ? recipe.image[0] : recipe.image,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}
