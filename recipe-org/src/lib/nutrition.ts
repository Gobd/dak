import type {
  Ingredient,
  IngredientNutrition,
  NutritionUnit,
  RecipeIngredientLine,
} from '../types';

export interface NutritionTotals {
  calories: number;
  protein_g: number;
  fiber_g: number;
}

export interface IngredientNutritionResult {
  totals: NutritionTotals;
  profile: IngredientNutrition | null;
}

export function findNutritionProfile(
  ingredient: Ingredient | undefined,
  unit: NutritionUnit,
): IngredientNutrition | null {
  if (!ingredient) return null;
  return ingredient.nutrition.find((profile) => profile.unit === unit) || null;
}

export function calculateIngredientNutrition(
  line: Pick<RecipeIngredientLine, 'amount' | 'unit'> & { ingredient?: Ingredient },
): IngredientNutritionResult {
  const profile = findNutritionProfile(line.ingredient, line.unit);
  if (!profile) {
    return { totals: { calories: 0, protein_g: 0, fiber_g: 0 }, profile: null };
  }

  return {
    profile,
    totals: {
      calories: line.amount * Number(profile.calories),
      protein_g: line.amount * Number(profile.protein_g),
      fiber_g: line.amount * Number(profile.fiber_g),
    },
  };
}

export function calculateRecipeTotals(lines: RecipeIngredientLine[]): NutritionTotals {
  return lines.reduce(
    (totals, line) => {
      const result = calculateIngredientNutrition(line);
      return {
        calories: totals.calories + result.totals.calories,
        protein_g: totals.protein_g + result.totals.protein_g,
        fiber_g: totals.fiber_g + result.totals.fiber_g,
      };
    },
    { calories: 0, protein_g: 0, fiber_g: 0 },
  );
}

const COMMON_FRACTIONS = [
  { numerator: 1, denominator: 2 },
  { numerator: 1, denominator: 3 },
  { numerator: 2, denominator: 3 },
  { numerator: 1, denominator: 4 },
  { numerator: 3, denominator: 4 },
  { numerator: 1, denominator: 5 },
  { numerator: 2, denominator: 5 },
  { numerator: 3, denominator: 5 },
  { numerator: 4, denominator: 5 },
  { numerator: 1, denominator: 6 },
  { numerator: 5, denominator: 6 },
  { numerator: 1, denominator: 8 },
  { numerator: 3, denominator: 8 },
  { numerator: 5, denominator: 8 },
  { numerator: 7, denominator: 8 },
  { numerator: 1, denominator: 10 },
  { numerator: 3, denominator: 10 },
  { numerator: 7, denominator: 10 },
  { numerator: 9, denominator: 10 },
  { numerator: 1, denominator: 12 },
  { numerator: 5, denominator: 12 },
  { numerator: 7, denominator: 12 },
  { numerator: 11, denominator: 12 },
  { numerator: 1, denominator: 16 },
  { numerator: 3, denominator: 16 },
  { numerator: 5, denominator: 16 },
  { numerator: 7, denominator: 16 },
];

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.0005) return '0';

  const absolute = Math.abs(value);
  const whole = Math.floor(absolute);
  const fraction = absolute - whole;
  const closest = COMMON_FRACTIONS.reduce<{ numerator: number; denominator: number; distance: number } | null>(
    (best, candidate) => {
      const distance = Math.abs(fraction - candidate.numerator / candidate.denominator);
      return !best || distance < best.distance ? { ...candidate, distance } : best;
    },
    null,
  );

  if (closest && closest.distance < 0.012) {
    const sign = value < 0 ? '-' : '';
    if (whole === 0) return `${sign}${closest.numerator}/${closest.denominator}`;
    return `${sign}${whole} ${closest.numerator}/${closest.denominator}`;
  }

  return Number(value.toFixed(3)).toString();
}

export function formatNutritionNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—';
  return Number(value.toFixed(decimals)).toString();
}
