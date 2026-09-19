import { useState } from 'react';
import { Card, Input } from '@dak/ui';
import {
  calculateIngredientNutrition,
  calculateRecipeTotals,
  formatNutritionNumber,
  formatQuantity,
} from '../lib/nutrition';
import type { RecipeIngredientLine } from '../types';

interface NutritionSummaryProps {
  lines: RecipeIngredientLine[];
}

export function NutritionSummary({ lines }: NutritionSummaryProps) {
  const [servings, setServings] = useState(1);
  const totals = calculateRecipeTotals(lines);
  const safeServings = servings > 0 ? servings : 1;
  const missingNutrition = lines.filter(
    (line) => calculateIngredientNutrition(line).profile === null,
  );

  const metrics = [
    { label: 'Calories', total: totals.calories, suffix: '' },
    { label: 'Protein', total: totals.protein_g, suffix: 'g' },
    { label: 'Fiber', total: totals.fiber_g, suffix: 'g' },
  ];

  return (
    <Card className="mb-8 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-text">Nutrition</h2>
          <p className="text-sm text-text-secondary mt-1">
            Adjust servings to see the amount and nutrition for each portion.
          </p>
        </div>
        <div className="w-32">
          <Input
            type="number"
            min="0.01"
            step="any"
            label="Servings"
            value={servings}
            onChange={(event) => setServings(Number(event.target.value) || 1)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg bg-surface-sunken p-3">
            <p className="text-xs text-text-secondary">{metric.label}</p>
            <p className="text-xl font-semibold text-text">
              {formatNutritionNumber(metric.total)}
              {metric.suffix}
            </p>
            <p className="text-xs text-text-muted">
              {formatNutritionNumber(metric.total / safeServings)}
              {metric.suffix} per serving
            </p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-2">
          Ingredient amount per serving
        </h3>
        <div className="divide-y divide-border border border-border rounded-md">
          {lines.map((line) => {
            const nutrition = calculateIngredientNutrition(line);
            return (
              <div
                key={line.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="text-text">{line.ingredient?.name || 'Unknown ingredient'}</span>
                <span className="text-text-secondary whitespace-nowrap">
                  {formatQuantity(line.amount / safeServings)} {line.unit}
                  {!nutrition.profile && (
                    <span className="text-warning ml-2">nutrition missing</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {missingNutrition.length > 0 && (
        <p className="text-sm text-warning mt-4">
          Add nutrition for the exact unit used by each flagged ingredient in Edit Recipe. The
          recipe will not substitute another unit automatically.
        </p>
      )}
    </Card>
  );
}
