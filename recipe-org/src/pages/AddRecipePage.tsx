import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Toggle } from '@dak/ui';
import { TagInput } from '../components/TagInput';
import { DeweyAutoSelector } from '../components/DeweyAutoSelector';
import { useRecipeStore } from '../stores/recipe-store';
import type { Recipe } from '../types';

export function AddRecipePage() {
  const navigate = useNavigate();
  const [recipeName, setRecipeName] = useState('');
  const [recipePage, setRecipePage] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [deweyDecimal, setDeweyDecimal] = useState('');
  const [shouldNavigateToRecipe, setShouldNavigateToRecipe] = useState(true);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipeName.trim()) return;

    const newRecipe: Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
      dewey_decimal: deweyDecimal || undefined,
      name: recipeName.trim(),
      page: recipePage.trim() || undefined,
      tags: tags,
    };

    try {
      const created = await addRecipe(newRecipe);
      if (shouldNavigateToRecipe) {
        navigate(`/recipe/${created.id}`);
      } else {
        setRecipeName('');
        setRecipePage('');
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
    </div>
  );
}
