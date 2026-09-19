import { useEffect, useMemo, useState } from 'react';
import { Button, Card, ConfirmModal, Input, Spinner } from '@dak/ui';
import { useRecipeStore } from '../stores/recipe-store';
import { NUTRITION_UNITS, type Ingredient, type NutritionUnit } from '../types';

interface NutritionDraft {
  id?: string;
  unit: NutritionUnit;
  calories: number;
  protein_g: number;
  fiber_g: number;
}

function IngredientCard({ ingredient }: { ingredient: Ingredient }) {
  const { updateIngredient, saveIngredientNutrition, deleteIngredientNutrition } = useRecipeStore();
  const [name, setName] = useState(ingredient.name);
  const [nutritionRows, setNutritionRows] = useState<NutritionDraft[]>(() =>
    ingredient.nutrition.map((row) => ({
      id: row.id,
      unit: row.unit,
      calories: row.calories,
      protein_g: row.protein_g,
      fiber_g: row.fiber_g,
    })),
  );
  const [savingName, setSavingName] = useState(false);
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [rowPendingDelete, setRowPendingDelete] = useState<number | null>(null);

  const updateRow = (index: number, updates: Partial<NutritionDraft>) => {
    setNutritionRows((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...updates } : row)),
    );
  };

  const saveName = async () => {
    if (!name.trim() || name.trim() === ingredient.name) return;
    setSavingName(true);
    try {
      await updateIngredient(ingredient.id, name);
    } finally {
      setSavingName(false);
    }
  };

  const saveRow = async (index: number) => {
    const row = nutritionRows[index];
    if (!row) return;
    const rowKey = row.id || `${ingredient.id}-new-${index}`;
    setSavingRow(rowKey);
    try {
      const saved = await saveIngredientNutrition(ingredient.id, row);
      updateRow(index, { id: saved.id });
    } finally {
      setSavingRow(null);
    }
  };

  const isRowSaved = (row: NutritionDraft) => {
    if (!row.id) return false;
    const savedRow = ingredient.nutrition.find((item) => item.id === row.id);
    return Boolean(
      savedRow &&
      savedRow.unit === row.unit &&
      Number(savedRow.calories) === Number(row.calories) &&
      Number(savedRow.protein_g) === Number(row.protein_g) &&
      Number(savedRow.fiber_g) === Number(row.fiber_g),
    );
  };

  const nameIsSaved = name.trim() === ingredient.name;

  const removeUnsavedRow = (index: number) => {
    const row = nutritionRows[index];
    if (!row) return;

    setNutritionRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
  };

  const requestRemoveRow = (index: number) => {
    const row = nutritionRows[index];
    if (!row) return;

    if (row.id) {
      setRowPendingDelete(index);
    } else {
      removeUnsavedRow(index);
    }
  };

  const confirmRemoveRow = async () => {
    if (rowPendingDelete === null) return;
    const row = nutritionRows[rowPendingDelete];
    if (!row?.id) return;

    await deleteIngredientNutrition(row.id);
    removeUnsavedRow(rowPendingDelete);
    setRowPendingDelete(null);
  };

  return (
    <Card className="p-5">
      <div className="flex items-end gap-2 mb-5">
        <div className="flex-1">
          <Input
            label="Ingredient"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        {!nameIsSaved && (
          <Button variant="secondary" onClick={saveName} disabled={savingName || !name.trim()}>
            {savingName ? 'Saving...' : 'Save name'}
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-text-secondary">Nutrition by unit</h2>
          <p className="text-xs text-text-muted mt-1">
            Add separate values for every unit you use. Values are per one selected unit.
          </p>
        </div>

        {nutritionRows.map((row, index) => (
          <div key={row.id || `new-${index}`} className="border border-border rounded-lg p-3">
            <div className="grid grid-cols-[7rem_1fr_1fr_1fr_auto] items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Unit</label>
                <select
                  value={row.unit}
                  onChange={(event) =>
                    updateRow(index, { unit: event.target.value as NutritionUnit })
                  }
                  className="w-full px-2 py-2 rounded text-sm border border-border bg-surface-sunken text-text outline-none focus:border-accent"
                >
                  {NUTRITION_UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.value}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                type="number"
                min="0"
                step="any"
                size="sm"
                label="Calories"
                value={row.calories}
                onChange={(event) => updateRow(index, { calories: Number(event.target.value) })}
              />
              <Input
                type="number"
                min="0"
                step="any"
                size="sm"
                label="Protein g"
                value={row.protein_g}
                onChange={(event) => updateRow(index, { protein_g: Number(event.target.value) })}
              />
              <Input
                type="number"
                min="0"
                step="any"
                size="sm"
                label="Fiber g"
                value={row.fiber_g}
                onChange={(event) => updateRow(index, { fiber_g: Number(event.target.value) })}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => requestRemoveRow(index)}
                title="Remove nutrition row"
              >
                ×
              </Button>
            </div>
            {!isRowSaved(row) && (
              <div className="flex justify-end mt-3">
                <Button
                  size="sm"
                  onClick={() => saveRow(index)}
                  disabled={savingRow === (row.id || `${ingredient.id}-new-${index}`)}
                >
                  {savingRow === (row.id || `${ingredient.id}-new-${index}`)
                    ? 'Saving...'
                    : 'Save nutrition'}
                </Button>
              </div>
            )}
          </div>
        ))}

        <Button
          variant="secondary"
          onClick={() =>
            setNutritionRows((rows) => [
              ...rows,
              { unit: 'g', calories: 0, protein_g: 0, fiber_g: 0 },
            ])
          }
        >
          Add unit row
        </Button>
      </div>

      <ConfirmModal
        open={rowPendingDelete !== null}
        onClose={() => setRowPendingDelete(null)}
        onConfirm={() => void confirmRemoveRow()}
        title="Delete nutrition row"
        message={`Remove the saved nutrition values per ${rowPendingDelete !== null ? nutritionRows[rowPendingDelete]?.unit || 'unit' : 'unit'}? Recipes using this unit will need nutrition added again.`}
        confirmText="Delete"
        variant="danger"
      />
    </Card>
  );
}

export function IngredientsPage() {
  const { ingredients, ingredientsLoading, loadIngredients, createIngredient } = useRecipeStore();
  const [search, setSearch] = useState('');
  const [newIngredientName, setNewIngredientName] = useState('');
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filteredIngredients = useMemo(
    () =>
      ingredients.filter((ingredient) =>
        ingredient.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [ingredients, search],
  );
  const totalPages = Math.max(1, Math.ceil(filteredIngredients.length / pageSize));
  const visibleIngredients = filteredIngredients.slice((page - 1) * pageSize, page * pageSize);

  const handleCreate = async () => {
    if (!newIngredientName.trim()) return;
    setCreating(true);
    try {
      await createIngredient(newIngredientName);
      setNewIngredientName('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Global Ingredients</h1>
        <p className="text-sm text-text-secondary mt-1">
          These are your reusable ingredients. Most edits can also be made directly while editing a
          recipe.
        </p>
      </div>

      <Card className="p-4 mb-6">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="New ingredient"
              value={newIngredientName}
              onChange={(event) => setNewIngredientName(event.target.value)}
              placeholder="e.g. Chicken breast"
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreate();
              }}
            />
          </div>
          <Button onClick={handleCreate} disabled={creating || !newIngredientName.trim()}>
            {creating ? 'Adding...' : 'Add ingredient'}
          </Button>
        </div>
      </Card>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search ingredients..."
        className="mb-4"
      />

      {ingredientsLoading && ingredients.length === 0 ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : filteredIngredients.length === 0 ? (
        <p className="text-sm text-text-secondary py-8 text-center">No ingredients yet.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, filteredIngredients.length)} of {filteredIngredients.length}{' '}
            ingredients
          </p>
          {visibleIngredients.map((ingredient) => (
            <IngredientCard key={ingredient.id} ingredient={ingredient} />
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-text-secondary">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
