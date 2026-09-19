export interface RecipeFile {
  id: string;
  recipe_id: string;
  filename: string;
  file_path: string;
  created_at: string;
}

export const NUTRITION_UNITS = [
  { value: 'g', label: 'grams', family: 'mass' },
  { value: 'kg', label: 'kilograms', family: 'mass' },
  { value: 'oz', label: 'ounces', family: 'mass' },
  { value: 'lb', label: 'pounds', family: 'mass' },
  { value: 'ml', label: 'milliliters', family: 'volume' },
  { value: 'tsp', label: 'teaspoons', family: 'volume' },
  { value: 'tbsp', label: 'tablespoons', family: 'volume' },
  { value: 'cup', label: 'cups', family: 'volume' },
  { value: 'each', label: 'each', family: 'count' },
] as const;

export type NutritionUnit = (typeof NUTRITION_UNITS)[number]['value'];
export type NutritionUnitFamily = (typeof NUTRITION_UNITS)[number]['family'];

export interface IngredientNutrition {
  id: string;
  user_id: string;
  ingredient_id: string;
  unit: NutritionUnit;
  calories: number;
  protein_g: number;
  fiber_g: number;
  created_at: string;
  updated_at: string;
}

export interface Ingredient {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  nutrition: IngredientNutrition[];
}

export interface RecipeIngredientLine {
  id: string;
  user_id: string;
  recipe_id: string;
  ingredient_id: string;
  amount: number;
  unit: NutritionUnit;
  sort_order: number;
  created_at: string;
  updated_at: string;
  ingredient?: Ingredient;
}

export interface RecipeIngredientLineDraft {
  id?: string;
  ingredient_id?: string;
  ingredient_name: string;
  amount: number;
  unit: NutritionUnit;
  sort_order: number;
  nutrition?: {
    calories: number;
    protein_g: number;
    fiber_g: number;
  };
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  page?: string;
  url?: string;
  recipe?: string;
  notes?: string;
  rating?: number;
  dewey_decimal?: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  files?: RecipeFile[];
  ingredient_lines?: RecipeIngredientLine[];
}

export type RecipeInput = Omit<
  Recipe,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'ingredient_lines'
> & {
  ingredient_lines?: RecipeIngredientLineDraft[];
};

export type RecipeUpdate = Partial<Omit<Recipe, 'ingredient_lines'>> & {
  ingredient_lines?: RecipeIngredientLineDraft[];
};

export interface DeweyCategory {
  id: string;
  user_id: string;
  dewey_code: string;
  name: string;
  level: number;
  parent_code?: string;
  is_active: boolean;
  created_at: string;
}
