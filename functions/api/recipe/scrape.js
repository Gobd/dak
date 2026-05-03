// Cloudflare Pages Function for scraping recipe JSON-LD from URLs
import { getCorsHeaders, handleOptions } from '../_cors.js';

// Extract JSON-LD scripts and recipe notes using HTMLRewriter (proper HTML parsing).
// Notes are rarely present in JSON-LD — most WordPress recipe plugins only render them
// into the page HTML — so we grab them via CSS selectors covering the common plugins.
async function extractFromHtml(response) {
  const jsonLdContents = [];
  let currentScript = '';

  // Collect <li> text inside known "notes" containers. We track which container we're
  // inside via enter/exit handlers so that <li> text elsewhere on the page is ignored.
  const notes = [];
  let noteDepth = 0;
  let currentNote = '';
  let inNoteLi = false;

  const noteContainerSelectors = [
    '.wprm-recipe-notes', // WP Recipe Maker
    '.tasty-recipes-notes-body', // Tasty Recipes
    '.mv-create-notes', // MV Create (Mediavine)
    '.recipe-notes',
    '[itemprop="recipeNotes"]',
  ].join(', ');

  const rewriter = new HTMLRewriter()
    .on('script[type="application/ld+json"]', {
      text(text) {
        currentScript += text.text;
        if (text.lastInTextNode) {
          jsonLdContents.push(currentScript);
          currentScript = '';
        }
      },
    })
    .on(noteContainerSelectors, {
      element(el) {
        noteDepth++;
        el.onEndTag(() => {
          noteDepth--;
        });
      },
    })
    .on('li, p', {
      element(el) {
        if (noteDepth > 0) {
          inNoteLi = true;
          currentNote = '';
          el.onEndTag(() => {
            const cleaned = currentNote.trim();
            if (cleaned) notes.push(cleaned);
            currentNote = '';
            inNoteLi = false;
          });
        }
      },
      text(text) {
        if (inNoteLi) currentNote += text.text;
      },
    });

  await rewriter.transform(response).text();
  return { jsonLdContents, notes };
}

// Check if a JSON-LD node is a Recipe. @type can be a string OR an array of strings.
function isRecipe(node) {
  const t = node && node['@type'];
  if (!t) return false;
  return Array.isArray(t) ? t.includes('Recipe') : t === 'Recipe';
}

// Find Recipe in JSON-LD data
function findRecipe(jsonLdContents) {
  for (const content of jsonLdContents) {
    try {
      const data = JSON.parse(content);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        if (isRecipe(node)) return node;
        if (Array.isArray(node['@graph'])) {
          const found = node['@graph'].find(isRecipe);
          if (found) return found;
        }
      }
    } catch {
      // Invalid JSON, continue to next
    }
  }
  return null;
}

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

    // Extract JSON-LD and scraped notes using HTMLRewriter
    const { jsonLdContents, notes: htmlNotes } = await extractFromHtml(response);

    if (jsonLdContents.length === 0) {
      return new Response(JSON.stringify({ error: 'No JSON-LD found on page' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Find Recipe schema
    const recipe = findRecipe(jsonLdContents);

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

    // Recipe instructions can be a string, an array of strings, an array of HowToStep
    // objects, or a mix that includes HowToSection groupings (e.g. "For the sauce" +
    // its own steps). We flatten everything into a flat list of step strings, with the
    // section name prefixed as a pseudo-heading so grouping isn't lost.
    const formatInstructions = (instructions) => {
      if (!instructions) return [];
      if (typeof instructions === 'string') return [instructions];
      if (!Array.isArray(instructions)) return [];

      const out = [];
      const visit = (step) => {
        if (!step) return;
        if (typeof step === 'string') {
          const s = step.trim();
          if (s) out.push(s);
          return;
        }
        if (step['@type'] === 'HowToSection' && Array.isArray(step.itemListElement)) {
          if (step.name) out.push(`### ${step.name}`);
          for (const child of step.itemListElement) visit(child);
          return;
        }
        // HowToStep or generic object with a text/name field
        const text = (step.text || step.name || '').toString().trim();
        if (text) out.push(text);
      };
      for (const step of instructions) visit(step);
      return out;
    };

    // Notes: prefer JSON-LD if present (rare), otherwise fall back to the notes we
    // scraped out of the rendered HTML.
    const jsonLdNotes = (() => {
      const raw = recipe.recipeNotes || recipe.notes;
      if (!raw) return [];
      if (typeof raw === 'string') return [raw.trim()].filter(Boolean);
      if (Array.isArray(raw)) return raw.map((n) => (typeof n === 'string' ? n : n?.text || '')).filter(Boolean);
      return [];
    })();

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
      notes: jsonLdNotes.length > 0 ? jsonLdNotes : htmlNotes,
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
