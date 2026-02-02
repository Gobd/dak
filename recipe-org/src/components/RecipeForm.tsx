import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Toggle } from '@dak/ui';
import { TagInput } from './TagInput';
import { DeweyAutoSelector } from './DeweyAutoSelector';
import { useRecipeStore } from '../stores/recipe-store';
import type { Recipe } from '../types';

interface RecipeFormProps {
  availableTags: string[];
  onAddRecipe: (
    recipe: Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
    shouldNavigate?: boolean,
  ) => void;
}

export function RecipeForm({ availableTags, onAddRecipe }: RecipeFormProps) {
  const navigate = useNavigate();
  const [recipeName, setRecipeName] = useState('');
  const [recipePage, setRecipePage] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [deweyDecimal, setDeweyDecimal] = useState('');
  const [shouldNavigateToRecipe, setShouldNavigateToRecipe] = useState(false);

  const { deweyCategories, loadDeweyCategories } = useRecipeStore();

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipeName.trim()) return;

    const newRecipe: Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
      dewey_decimal: deweyDecimal || undefined,
      name: recipeName.trim(),
      page: recipePage.trim() || undefined,
      tags: tags,
    };

    onAddRecipe(newRecipe, shouldNavigateToRecipe);
    setRecipeName('');
    setRecipePage('');
    setTags([]);
    setDeweyDecimal('');
    setShouldNavigateToRecipe(false);
  };

  return (
    <Card className="mb-6 p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Recipe Name</label>
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

        <div className="space-y-2">
          <Button type="submit" className="w-full">
            Add Recipe
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/tags')}>
              View All Tags
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/dewey-admin')}>
              Dewey Admin
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
