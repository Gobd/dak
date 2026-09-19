import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button, Input } from '@dak/ui';
import { findNutritionProfile } from '../lib/nutrition';
import {
  NUTRITION_UNITS,
  type Ingredient,
  type NutritionUnit,
  type RecipeIngredientLineDraft,
} from '../types';

interface RecipeIngredientsEditorProps {
  lines: RecipeIngredientLineDraft[];
  ingredients: Ingredient[];
  onChange: (lines: RecipeIngredientLineDraft[]) => void;
}

const EMPTY_NUTRITION = { calories: 0, protein_g: 0, fiber_g: 0 };

export function RecipeIngredientsEditor({
  lines,
  ingredients,
  onChange,
}: RecipeIngredientsEditorProps) {
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);

  const updateLine = (index: number, updates: Partial<RecipeIngredientLineDraft>) => {
    onChange(
      lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...updates } : line)),
    );
  };

  const getIngredient = (line: RecipeIngredientLineDraft) =>
    ingredients.find((ingredient) => ingredient.id === line.ingredient_id);

  const handleIngredientChange = (index: number, name: string) => {
    const line = lines[index];
    if (!line) return;

    const existing = ingredients.find(
      (ingredient) => ingredient.name.toLowerCase() === name.trim().toLowerCase(),
    );
    const profile = existing ? findNutritionProfile(existing, line.unit) : null;
    const changedExistingIngredient = Boolean(
      line.ingredient_id && line.ingredient_id !== existing?.id,
    );

    updateLine(index, {
      ingredient_name: name,
      ingredient_id: existing?.id,
      nutrition: profile || changedExistingIngredient ? undefined : line.nutrition,
    });
  };

  const handleIngredientSelect = (index: number, ingredient: Ingredient) => {
    const line = lines[index];
    if (!line) return;

    const profile = findNutritionProfile(ingredient, line.unit);
    updateLine(index, {
      ingredient_name: ingredient.name,
      ingredient_id: ingredient.id,
      nutrition: profile ? undefined : undefined,
    });
    setActiveLineIndex(null);
  };

  const handleUnitChange = (index: number, unit: NutritionUnit) => {
    const line = lines[index];
    if (!line) return;

    const ingredient = getIngredient(line);
    const profile = findNutritionProfile(ingredient, unit);
    updateLine(index, {
      unit,
      nutrition: profile ? undefined : undefined,
    });
  };

  const handleNutritionChange = (
    index: number,
    field: 'calories' | 'protein_g' | 'fiber_g',
    value: string,
  ) => {
    const line = lines[index];
    if (!line) return;

    const nutrition = line.nutrition || { ...EMPTY_NUTRITION };
    updateLine(index, {
      nutrition: {
        ...nutrition,
        [field]: value === '' ? 0 : Number(value),
      },
    });
  };

  const addLine = () => {
    onChange([
      ...lines,
      {
        ingredient_name: '',
        amount: 1,
        unit: 'g',
        sort_order: lines.length,
      },
    ]);
  };

  const removeLine = (index: number) => {
    onChange(
      lines
        .filter((_, lineIndex) => lineIndex !== index)
        .map((line, sort_order) => ({ ...line, sort_order })),
    );
  };

  return (
    <div className="space-y-4">
      {lines.length === 0 && (
        <p className="text-sm text-text-muted">
          Add structured ingredients to calculate calories, protein, and fiber.
        </p>
      )}

      {lines.map((line, index) => {
        const ingredient = getIngredient(line);
        const profile = findNutritionProfile(ingredient, line.unit);
        const suggestions = line.ingredient_name.trim()
          ? ingredients
              .filter((item) =>
                item.name.toLowerCase().includes(line.ingredient_name.toLowerCase()),
              )
              .slice(0, 5)
          : [];
        const needsNutrition = Boolean(line.ingredient_name.trim()) && !profile;

        return (
          <div key={line.id || `new-${index}`} className="border border-border rounded-lg p-3">
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Ingredient
                </label>
                <Input
                  type="text"
                  size="sm"
                  value={line.ingredient_name}
                  onChange={(event) => handleIngredientChange(index, event.target.value)}
                  placeholder="Start typing an ingredient..."
                  onFocus={() => setActiveLineIndex(index)}
                  onBlur={() => {
                    window.setTimeout(() => setActiveLineIndex(null), 150);
                  }}
                />
                {activeLineIndex === index && suggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-surface-raised border border-border rounded-md shadow-lg overflow-hidden">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-text hover:bg-surface-sunken"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleIngredientSelect(index, suggestion)}
                      >
                        {suggestion.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-24">
                <label className="block text-xs font-medium text-text-secondary mb-1">Amount</label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  size="sm"
                  value={line.amount}
                  onChange={(event) => updateLine(index, { amount: Number(event.target.value) })}
                />
              </div>

              <div className="w-32">
                <label className="block text-xs font-medium text-text-secondary mb-1">Unit</label>
                <select
                  value={line.unit}
                  onChange={(event) => handleUnitChange(index, event.target.value as NutritionUnit)}
                  className="w-full px-2 py-2 rounded text-sm border border-border bg-surface-sunken text-text outline-none focus:border-accent"
                >
                  {NUTRITION_UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.value}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLine(index)}
                title="Remove ingredient"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {needsNutrition ? (
              <div className="mt-3 rounded-md bg-warning/10 border border-warning/20 p-3">
                <p className="text-xs text-warning mb-2">
                  Nutrition is not saved for this ingredient per {line.unit}. Add it here or choose
                  a unit with nutrition data.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    size="sm"
                    label={`Calories / ${line.unit}`}
                    value={line.nutrition ? line.nutrition.calories : ''}
                    onChange={(event) =>
                      handleNutritionChange(index, 'calories', event.target.value)
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    size="sm"
                    label={`Protein g / ${line.unit}`}
                    value={line.nutrition ? line.nutrition.protein_g : ''}
                    onChange={(event) =>
                      handleNutritionChange(index, 'protein_g', event.target.value)
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    size="sm"
                    label={`Fiber g / ${line.unit}`}
                    value={line.nutrition ? line.nutrition.fiber_g : ''}
                    onChange={(event) =>
                      handleNutritionChange(index, 'fiber_g', event.target.value)
                    }
                  />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-text-muted">
                Using saved global nutrition per {line.unit}: {profile?.calories ?? 0} cal,{' '}
                {profile?.protein_g ?? 0}g protein, {profile?.fiber_g ?? 0}g fiber.
              </p>
            )}
          </div>
        );
      })}

      <Button type="button" variant="secondary" onClick={addLine}>
        <Plus className="w-4 h-4 mr-2" />
        Add ingredient
      </Button>
    </div>
  );
}
