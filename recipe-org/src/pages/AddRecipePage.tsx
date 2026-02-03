import { Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Modal, Toggle } from '@dak/ui';
import { RecipeEditor } from '../components/RecipeEditor';
import { TagInput } from '../components/TagInput';
import { DeweyAutoSelector } from '../components/DeweyAutoSelector';
import { scrapeRecipe, formatRecipeAsMarkdown } from '../lib/recipe-scraper';
import { useRecipeStore } from '../stores/recipe-store';
import type { Recipe } from '../types';

export function AddRecipePage() {
  const navigate = useNavigate();
  const [recipeName, setRecipeName] = useState('');
  const [recipePage, setRecipePage] = useState('');
  const [recipeUrl, setRecipeUrl] = useState('');
  const [recipeContent, setRecipeContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [deweyDecimal, setDeweyDecimal] = useState('');
  const [shouldNavigateToRecipe, setShouldNavigateToRecipe] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapePreview, setScrapePreview] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  const { tags: availableTags, deweyCategories, loadDeweyCategories, addRecipe } = useRecipeStore();

  useEffect(() => {
    loadDeweyCategories();
  }, [loadDeweyCategories]);

  const getDeweyHierarchyTags = (deweyCode: string): string[] => {
    if (!deweyCode) return [];

    let baseCode = deweyCode;
    const isGeneratedSequence = deweyCode.match(/\.\d{3}$/);

    if (isGeneratedSequence) {
      const lastDotIndex = deweyCode.lastIndexOf('.');
      baseCode = deweyCode.substring(0, lastDotIndex);
    }

    const hierarchyTags: string[] = [];
    const levels = buildDeweyHierarchy(baseCode);

    for (const levelCode of levels) {
      const category = deweyCategories.find((cat) => cat.dewey_code === levelCode);
      if (category) {
        hierarchyTags.push(category.name);
      }
    }

    return hierarchyTags;
  };

  const buildDeweyHierarchy = (deweyCode: string): string[] => {
    const levels: string[] = [];
    let currentCode = deweyCode;

    while (currentCode) {
      levels.unshift(currentCode);

      const category = deweyCategories.find((cat) => cat.dewey_code === currentCode);
      if (category?.parent_code) {
        currentCode = category.parent_code;
      } else {
        break;
      }
    }

    return levels;
  };

  const handleDeweySelect = (deweyCode: string) => {
    setDeweyDecimal(deweyCode);

    const allTags = [...tags];
    const allDeweyNames = deweyCategories.map((cat) => cat.name);
    const nonDeweyTags = allTags.filter((tag) => !allDeweyNames.includes(tag));

    if (deweyCode) {
      const hierarchyTags = getDeweyHierarchyTags(deweyCode);
      setTags([...nonDeweyTags, ...hierarchyTags]);
    } else {
      setTags(nonDeweyTags);
    }
  };

  const handleFetchRecipe = async () => {
    if (!recipeUrl) return;

    setScraping(true);
    setScrapeError(null);

    try {
      const scrapedRecipe = await scrapeRecipe(recipeUrl);
      const markdown = formatRecipeAsMarkdown(scrapedRecipe);
      setScrapePreview(markdown);

      // Auto-fill name if empty
      if (!recipeName && scrapedRecipe.name) {
        setRecipeName(scrapedRecipe.name);
      }
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Failed to fetch recipe');
    } finally {
      setScraping(false);
    }
  };

  const handleImportRecipe = () => {
    if (scrapePreview) {
      if (recipeContent.trim()) {
        setRecipeContent(recipeContent + '\n\n---\n\n' + scrapePreview);
      } else {
        setRecipeContent(scrapePreview);
      }
      setScrapePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipeName.trim()) return;

    const newRecipe: Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
      dewey_decimal: deweyDecimal || undefined,
      name: recipeName.trim(),
      page: recipePage.trim() || undefined,
      url: recipeUrl.trim() || undefined,
      recipe: recipeContent.trim() || undefined,
      tags: tags,
    };

    try {
      const created = await addRecipe(newRecipe);
      if (shouldNavigateToRecipe) {
        navigate(`/recipe/${created.id}`);
      } else {
        setRecipeName('');
        setRecipePage('');
        setRecipeUrl('');
        setRecipeContent('');
        setTags([]);
        setDeweyDecimal('');
      }
    } catch (error) {
      console.error('Failed to add recipe:', error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold text-text mb-6">Add Recipe</h1>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Recipe Name
            </label>
            <Input
              type="text"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              placeholder="Enter recipe name..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Location</label>
            <Input
              type="text"
              value={recipePage}
              onChange={(e) => setRecipePage(e.target.value)}
              placeholder="Enter location reference..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">URL</label>
            <div className="flex gap-2">
              <Input
                type="url"
                value={recipeUrl}
                onChange={(e) => setRecipeUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleFetchRecipe}
                disabled={!recipeUrl || scraping}
              >
                <Globe className="w-4 h-4 mr-2" />
                {scraping ? 'Fetching...' : 'Fetch'}
              </Button>
            </div>
            {scrapeError && <p className="text-sm text-danger mt-1">{scrapeError}</p>}
          </div>

          {recipeContent && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Recipe</label>
              <div className="border border-border rounded-md bg-surface overflow-hidden">
                <RecipeEditor
                  content={recipeContent}
                  onChange={setRecipeContent}
                  placeholder="Recipe content..."
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Tags</label>
            <TagInput
              tags={tags}
              availableTags={availableTags}
              onTagsChange={setTags}
              placeholder="Add tags (press Enter to add)..."
            />
          </div>

          <DeweyAutoSelector onSelect={handleDeweySelect} selectedCode={deweyDecimal} />

          <div className="flex items-center gap-2">
            <Toggle checked={shouldNavigateToRecipe} onChange={setShouldNavigateToRecipe} />
            <label className="text-sm text-text-secondary">Go to recipe page after adding</label>
          </div>

          <Button type="submit" className="w-full">
            Add Recipe
          </Button>
        </form>
      </Card>

      <Modal
        open={!!scrapePreview}
        onClose={() => setScrapePreview(null)}
        title="Recipe Preview"
        wide
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Preview the fetched recipe below. Click Import to add it.
          </p>
          <div className="border border-border rounded-md bg-surface-sunken max-h-96 overflow-y-auto">
            <RecipeEditor content={scrapePreview || ''} onChange={() => {}} editable={false} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setScrapePreview(null)}>
              Cancel
            </Button>
            <Button onClick={handleImportRecipe}>Import</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
