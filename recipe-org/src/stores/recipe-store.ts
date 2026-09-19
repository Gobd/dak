import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type {
  DeweyCategory,
  Ingredient,
  IngredientNutrition,
  NutritionUnit,
  Recipe,
  RecipeFile,
  RecipeInput,
  RecipeIngredientLine,
  RecipeIngredientLineDraft,
  RecipeUpdate,
} from '../types';

interface RecipeStore {
  // State
  recipes: Recipe[];
  tags: string[];
  deweyCategories: DeweyCategory[];
  ingredients: Ingredient[];
  loading: boolean;
  searching: boolean;
  ingredientsLoading: boolean;
  ingredientsLoaded: boolean;
  error: string | null;
  deweyCategoriesLoaded: boolean;
  deweyCategoriesLoading: boolean;
  initialized: boolean;

  // Search state
  searchTerm: string;
  selectedTags: string[];

  // Actions
  setSearchTerm: (term: string) => void;
  setSelectedTags: (tags: string[]) => void;

  // Recipe operations
  loadRecipes: (
    searchTerm?: string,
    selectedTags?: string[],
    isSearching?: boolean,
  ) => Promise<void>;
  getAllRecipesForExport: () => Promise<Recipe[]>;
  addRecipe: (recipe: RecipeInput) => Promise<Recipe>;
  updateRecipe: (id: string, updates: RecipeUpdate) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  getRecipeById: (id: string) => Promise<Recipe | null>;
  getNextRecipe: (currentId: string) => Promise<Recipe | null>;
  getPreviousRecipe: (currentId: string) => Promise<Recipe | null>;

  // Ingredient and nutrition operations
  loadIngredients: (searchTerm?: string) => Promise<void>;
  createIngredient: (name: string) => Promise<Ingredient>;
  updateIngredient: (id: string, name: string) => Promise<Ingredient>;
  saveIngredientNutrition: (
    ingredientId: string,
    nutrition: {
      id?: string;
      unit: NutritionUnit;
      calories: number;
      protein_g: number;
      fiber_g: number;
    },
  ) => Promise<IngredientNutrition>;
  deleteIngredientNutrition: (nutritionId: string) => Promise<void>;
  saveRecipeIngredientLines: (
    recipeId: string,
    lines: RecipeIngredientLineDraft[],
  ) => Promise<RecipeIngredientLine[]>;

  // Tag operations
  loadTags: () => Promise<void>;
  deleteTag: (tagName: string) => Promise<void>;
  removeTagFromRecipe: (recipeId: string, tagToRemove: string) => Promise<void>;

  // Rating operations
  updateRecipeRating: (recipeId: string, rating: number) => Promise<void>;

  // Dewey operations
  loadDeweyCategories: () => Promise<void>;
  getNextDeweySequence: (baseCode: string) => Promise<string>;
  addDeweyCategory: (
    category: Omit<DeweyCategory, 'id' | 'user_id' | 'created_at'>,
  ) => Promise<DeweyCategory>;
  updateDeweyCategory: (id: string, updates: Partial<DeweyCategory>) => Promise<DeweyCategory>;
  deleteDeweyCategory: (id: string) => Promise<void>;

  // Tag operations with counts
  getTagsWithCounts: () => Promise<Array<{ name: string; count: number }>>;

  // File operations
  uploadFile: (recipeId: string, file: File) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  downloadFile: (file: RecipeFile) => Promise<void>;

  // Utility
  clearError: () => void;
  setError: (error: string) => void;
}

async function getOrCreateTags(tagNames: string[], userId: string): Promise<string[]> {
  const tagIds: string[] = [];

  for (const name of tagNames) {
    // Try to find existing tag
    const { data: existing } = await supabase
      .from('recipe_tags')
      .select('id')
      .eq('user_id', userId)
      .eq('name', name)
      .single();

    if (existing) {
      tagIds.push(existing.id);
    } else {
      // Create new tag
      const { data: newTag, error } = await supabase
        .from('recipe_tags')
        .insert({ user_id: userId, name })
        .select('id')
        .single();

      if (newTag && !error) {
        tagIds.push(newTag.id);
      }
    }
  }

  return tagIds;
}

function mapIngredientNutrition(data: Record<string, unknown>): IngredientNutrition {
  return {
    ...(data as unknown as IngredientNutrition),
    unit: data.unit as NutritionUnit,
    calories: Number(data.calories || 0),
    protein_g: Number(data.protein_g || 0),
    fiber_g: Number(data.fiber_g || 0),
  };
}

function mapIngredient(data: Record<string, unknown>): Ingredient {
  const nutrition = Array.isArray(data.recipe_ingredient_nutrition)
    ? data.recipe_ingredient_nutrition.map((item) =>
        mapIngredientNutrition(item as Record<string, unknown>),
      )
    : [];

  return {
    ...(data as unknown as Ingredient),
    nutrition,
  };
}

function mapRecipeIngredientLine(data: Record<string, unknown>): RecipeIngredientLine {
  const rawIngredient = data.recipe_ingredients;

  return {
    ...(data as unknown as RecipeIngredientLine),
    amount: Number(data.amount || 0),
    unit: data.unit as NutritionUnit,
    sort_order: Number(data.sort_order || 0),
    ingredient:
      rawIngredient && typeof rawIngredient === 'object'
        ? mapIngredient(rawIngredient as Record<string, unknown>)
        : undefined,
  };
}

async function fetchIngredientById(ingredientId: string): Promise<Ingredient | null> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('*, recipe_ingredient_nutrition(*)')
    .eq('id', ingredientId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapIngredient(data as Record<string, unknown>) : null;
}

async function findOrCreateIngredient(name: string, userId: string): Promise<Ingredient> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Ingredient name is required');

  const { data: existing, error: lookupError } = await supabase
    .from('recipe_ingredients')
    .select('*, recipe_ingredient_nutrition(*)')
    .eq('user_id', userId)
    .ilike('name', trimmedName)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing) return mapIngredient(existing as Record<string, unknown>);

  const { data: created, error: createError } = await supabase
    .from('recipe_ingredients')
    .insert({ user_id: userId, name: trimmedName })
    .select('*, recipe_ingredient_nutrition(*)')
    .single();

  if (!createError && created) return mapIngredient(created as Record<string, unknown>);

  // A case-only duplicate can race the lookup. Re-read it after a unique
  // constraint error so saving a recipe remains friendly and idempotent.
  const { data: raced } = await supabase
    .from('recipe_ingredients')
    .select('*, recipe_ingredient_nutrition(*)')
    .eq('user_id', userId)
    .ilike('name', trimmedName)
    .maybeSingle();

  if (raced) return mapIngredient(raced as Record<string, unknown>);
  throw createError || new Error('Failed to create ingredient');
}

async function fetchRecipeWithTags(recipeId: string): Promise<Recipe | null> {
  const [{ data: recipe, error }, { data: ingredientLines, error: ingredientLinesError }] =
    await Promise.all([
      supabase
        .from('recipes')
        .select(`
          *,
          recipe_tag_map(tag_id, recipe_tags(name)),
          recipe_files(id, filename, file_path, created_at)
        `)
        .eq('id', recipeId)
        .single(),
      supabase
        .from('recipe_ingredient_lines')
        .select('*, recipe_ingredients(*, recipe_ingredient_nutrition(*))')
        .eq('recipe_id', recipeId)
        .order('sort_order', { ascending: true }),
    ]);

  if (error || ingredientLinesError || !recipe) {
    if (ingredientLinesError) throw ingredientLinesError;
    return null;
  }

  return {
    ...recipe,
    tags:
      recipe.recipe_tag_map?.map((rt: { recipe_tags: { name: string } }) => rt.recipe_tags.name) ||
      [],
    files: recipe.recipe_files || [],
    ingredient_lines: (ingredientLines || []).map((line) =>
      mapRecipeIngredientLine(line as Record<string, unknown>),
    ),
  };
}

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  recipes: [],
  tags: [],
  deweyCategories: [],
  ingredients: [],
  loading: false,
  searching: false,
  ingredientsLoading: false,
  ingredientsLoaded: false,
  error: null,
  deweyCategoriesLoaded: false,
  deweyCategoriesLoading: false,
  initialized: false,
  searchTerm: '',
  selectedTags: [],

  clearError: () => set({ error: null }),
  setError: (error) => set({ error }),

  setSearchTerm: (term) => {
    set({ searchTerm: term });
    get().loadRecipes(term, get().selectedTags, true);
  },

  setSelectedTags: (tags) => {
    set({ selectedTags: tags });
    get().loadRecipes(get().searchTerm, tags, true);
  },

  loadRecipes: async (searchTerm = '', selectedTags = [], isSearching = false) => {
    if (isSearching) {
      set({ error: null, searching: true });
    } else {
      set({ error: null, loading: true });
    }

    try {
      let query = supabase
        .from('recipes')
        .select(`
          *,
          recipe_tag_map(tag_id, recipe_tags(name)),
          recipe_files(id, filename, file_path, created_at)
        `)
        .order('name', { ascending: true });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,page.ilike.%${searchTerm}%`);
      }

      const { data: recipes, error } = await query;

      if (error) throw error;

      let processedRecipes = (recipes || []).map((r) => ({
        ...r,
        tags:
          r.recipe_tag_map?.map((rt: { recipe_tags: { name: string } }) => rt.recipe_tags.name) ||
          [],
        files: r.recipe_files || [],
      }));

      // Filter by selected tags if any
      if (selectedTags.length > 0) {
        processedRecipes = processedRecipes.filter((recipe) =>
          selectedTags.every((tag) => recipe.tags.includes(tag)),
        );
      }

      // Load tags in parallel
      const { data: tagsData } = await supabase.from('recipe_tags').select('name').order('name');

      const uniqueTags = tagsData?.map((t) => t.name) || [];

      if (isSearching) {
        set({ recipes: processedRecipes, tags: uniqueTags, searching: false, initialized: true });
      } else {
        set({ recipes: processedRecipes, tags: uniqueTags, loading: false, initialized: true });
      }
    } catch (error) {
      console.error('Failed to load recipes:', error);
      if (isSearching) {
        set({ error: 'Failed to load recipes', searching: false });
      } else {
        set({ error: 'Failed to load recipes', loading: false });
      }
    }
  },

  getAllRecipesForExport: async () => {
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        recipe_tag_map(tag_id, recipe_tags(name))
      `)
      .order('name');

    if (error) throw error;

    return (data || []).map((r) => ({
      ...r,
      tags:
        r.recipe_tag_map?.map((rt: { recipe_tags: { name: string } }) => rt.recipe_tags.name) || [],
    }));
  },

  addRecipe: async (recipe) => {
    set({ error: null, loading: true });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { tags, ingredient_lines, ...recipeData } = recipe;

      // Insert recipe
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({ ...recipeData, user_id: user.id })
        .select()
        .single();

      if (recipeError || !newRecipe) throw recipeError;

      // Handle tags
      if (tags && tags.length > 0) {
        const tagIds = await getOrCreateTags(tags, user.id);
        const recipeTags = tagIds.map((tagId) => ({
          recipe_id: newRecipe.id,
          tag_id: tagId,
        }));
        await supabase.from('recipe_tag_map').insert(recipeTags);
      }

      if (ingredient_lines !== undefined) {
        await get().saveRecipeIngredientLines(newRecipe.id, ingredient_lines);
      }

      const fullRecipe = await fetchRecipeWithTags(newRecipe.id);
      if (!fullRecipe) throw new Error('Failed to fetch created recipe');

      // Optimistic update
      const { searchTerm, selectedTags, recipes } = get();
      const matchesSearch =
        !searchTerm ||
        fullRecipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fullRecipe.page?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTags = selectedTags.every((tag) => fullRecipe.tags.includes(tag));

      if (matchesSearch && matchesTags) {
        set({ loading: false, recipes: [fullRecipe, ...recipes] });
      } else {
        set({ loading: false });
      }

      get().loadTags();
      return fullRecipe;
    } catch (error) {
      console.error('Failed to add recipe:', error);
      set({ error: 'Failed to add recipe', loading: false });
      throw error;
    }
  },

  updateRecipe: async (id, updates) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { tags, ingredient_lines, ...recipeUpdates } = updates;

      // Optimistic update
      const { recipes } = get();
      const updatedRecipes = recipes.map((recipe) =>
        recipe.id === id
          ? { ...recipe, ...updates, ingredient_lines: recipe.ingredient_lines }
          : recipe,
      );
      set({ recipes: updatedRecipes });

      // Update recipe fields
      if (Object.keys(recipeUpdates).length > 0) {
        const { error } = await supabase.from('recipes').update(recipeUpdates).eq('id', id);
        if (error) throw error;
      }

      // Update tags if provided
      if (tags !== undefined) {
        // Remove existing tags
        await supabase.from('recipe_tag_map').delete().eq('recipe_id', id);

        // Add new tags
        if (tags.length > 0) {
          const tagIds = await getOrCreateTags(tags, user.id);
          const recipeTags = tagIds.map((tagId) => ({
            recipe_id: id,
            tag_id: tagId,
          }));
          await supabase.from('recipe_tag_map').insert(recipeTags);
        }

        get().loadTags();
      }

      if (ingredient_lines !== undefined) {
        await get().saveRecipeIngredientLines(id, ingredient_lines);
      }
    } catch (error) {
      console.error('Failed to update recipe:', error);
      set({ error: 'Failed to update recipe' });
      get().loadRecipes(get().searchTerm, get().selectedTags);
      throw error;
    }
  },

  deleteRecipe: async (id) => {
    try {
      // Optimistic update
      const { recipes } = get();
      set({ recipes: recipes.filter((r) => r.id !== id) });

      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) throw error;

      get().loadTags();
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      set({ error: 'Failed to delete recipe' });
      get().loadRecipes(get().searchTerm, get().selectedTags);
      throw error;
    }
  },

  getRecipeById: async (id) => {
    set({ error: null, loading: true });
    try {
      const recipe = await fetchRecipeWithTags(id);
      set({ loading: false });
      return recipe;
    } catch (error) {
      console.error('Failed to get recipe:', error);
      set({ error: 'Failed to load recipe', loading: false });
      throw error;
    }
  },

  getNextRecipe: async (currentId) => {
    try {
      const { recipes } = get();
      const currentIndex = recipes.findIndex((r) => r.id === currentId);
      if (currentIndex === -1 || currentIndex >= recipes.length - 1) return null;
      return recipes[currentIndex + 1] || null;
    } catch (error) {
      console.error('Failed to get next recipe:', error);
      return null;
    }
  },

  getPreviousRecipe: async (currentId) => {
    try {
      const { recipes } = get();
      const currentIndex = recipes.findIndex((r) => r.id === currentId);
      if (currentIndex <= 0) return null;
      return recipes[currentIndex - 1] || null;
    } catch (error) {
      console.error('Failed to get previous recipe:', error);
      return null;
    }
  },

  loadIngredients: async (searchTerm = '') => {
    set({ ingredientsLoading: true, error: null });
    try {
      let query = supabase
        .from('recipe_ingredients')
        .select('*, recipe_ingredient_nutrition(*)')
        .order('name', { ascending: true });

      if (searchTerm.trim()) {
        query = query.ilike('name', `%${searchTerm.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      set({
        ingredients: (data || []).map((ingredient) =>
          mapIngredient(ingredient as Record<string, unknown>),
        ),
        ingredientsLoading: false,
        ingredientsLoaded: true,
      });
    } catch (error) {
      console.error('Failed to load ingredients:', error);
      set({ error: 'Failed to load ingredients', ingredientsLoading: false });
      throw error;
    }
  },

  createIngredient: async (name) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ingredient = await findOrCreateIngredient(name, user.id);
      const ingredients = get().ingredients.filter((item) => item.id !== ingredient.id);
      set({
        ingredients: [...ingredients, ingredient].sort((a, b) => a.name.localeCompare(b.name)),
      });
      return ingredient;
    } catch (error) {
      console.error('Failed to create ingredient:', error);
      set({ error: 'Failed to create ingredient' });
      throw error;
    }
  },

  updateIngredient: async (id, name) => {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Ingredient name is required');

    try {
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .update({ name: trimmedName })
        .eq('id', id)
        .select('*, recipe_ingredient_nutrition(*)')
        .single();

      if (error || !data) throw error || new Error('Failed to update ingredient');

      const ingredient = mapIngredient(data as Record<string, unknown>);
      set({
        ingredients: get()
          .ingredients.map((item) => (item.id === id ? ingredient : item))
          .sort((a, b) => a.name.localeCompare(b.name)),
      });
      return ingredient;
    } catch (error) {
      console.error('Failed to update ingredient:', error);
      set({ error: 'Failed to update ingredient' });
      throw error;
    }
  },

  saveIngredientNutrition: async (ingredientId, nutrition) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        user_id: user.id,
        ingredient_id: ingredientId,
        unit: nutrition.unit,
        calories: nutrition.calories,
        protein_g: nutrition.protein_g,
        fiber_g: nutrition.fiber_g,
      };

      const result = nutrition.id
        ? await supabase
            .from('recipe_ingredient_nutrition')
            .update(payload)
            .eq('id', nutrition.id)
            .select()
            .single()
        : await supabase
            .from('recipe_ingredient_nutrition')
            .upsert(payload, { onConflict: 'ingredient_id,unit' })
            .select()
            .single();

      if (result.error || !result.data) {
        throw result.error || new Error('Failed to save nutrition');
      }

      const mapped = mapIngredientNutrition(result.data as Record<string, unknown>);
      const existingIngredient = get().ingredients.find((item) => item.id === ingredientId);
      if (existingIngredient) {
        const nutritionRows = existingIngredient.nutrition.filter(
          (item) => item.id !== mapped.id && item.unit !== mapped.unit,
        );
        set({
          ingredients: get().ingredients.map((item) =>
            item.id === ingredientId
              ? {
                  ...item,
                  nutrition: [...nutritionRows, mapped].sort((a, b) =>
                    a.unit.localeCompare(b.unit),
                  ),
                }
              : item,
          ),
        });
      }

      return mapped;
    } catch (error) {
      console.error('Failed to save ingredient nutrition:', error);
      set({ error: 'Failed to save ingredient nutrition' });
      throw error;
    }
  },

  deleteIngredientNutrition: async (nutritionId) => {
    try {
      const { error } = await supabase
        .from('recipe_ingredient_nutrition')
        .delete()
        .eq('id', nutritionId);
      if (error) throw error;

      set({
        ingredients: get().ingredients.map((ingredient) => ({
          ...ingredient,
          nutrition: ingredient.nutrition.filter((item) => item.id !== nutritionId),
        })),
      });
    } catch (error) {
      console.error('Failed to delete ingredient nutrition:', error);
      set({ error: 'Failed to delete ingredient nutrition' });
      throw error;
    }
  },

  saveRecipeIngredientLines: async (recipeId, lines) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const persistedLines: Array<{
        user_id: string;
        recipe_id: string;
        ingredient_id: string;
        amount: number;
        unit: NutritionUnit;
        sort_order: number;
      }> = [];

      for (const line of lines) {
        const name = line.ingredient_name.trim();
        if (!name || !Number.isFinite(line.amount) || line.amount <= 0) continue;

        const ingredient = line.ingredient_id
          ? await fetchIngredientById(line.ingredient_id)
          : await findOrCreateIngredient(name, user.id);

        if (!ingredient) {
          throw new Error(`Ingredient not found: ${name}`);
        }

        if (!get().ingredients.some((item) => item.id === ingredient.id)) {
          set({ ingredients: [...get().ingredients, ingredient] });
        }

        if (line.nutrition) {
          await get().saveIngredientNutrition(ingredient.id, {
            unit: line.unit,
            calories: line.nutrition.calories,
            protein_g: line.nutrition.protein_g,
            fiber_g: line.nutrition.fiber_g,
          });
        }

        persistedLines.push({
          user_id: user.id,
          recipe_id: recipeId,
          ingredient_id: ingredient.id,
          amount: line.amount,
          unit: line.unit,
          sort_order: line.sort_order,
        });
      }

      const { error: deleteError } = await supabase
        .from('recipe_ingredient_lines')
        .delete()
        .eq('recipe_id', recipeId);
      if (deleteError) throw deleteError;

      if (persistedLines.length === 0) return [];

      const { data, error } = await supabase
        .from('recipe_ingredient_lines')
        .insert(persistedLines)
        .select('*, recipe_ingredients(*, recipe_ingredient_nutrition(*))')
        .order('sort_order', { ascending: true });
      if (error) throw error;

      return (data || []).map((line) => mapRecipeIngredientLine(line as Record<string, unknown>));
    } catch (error) {
      console.error('Failed to save recipe ingredients:', error);
      set({ error: 'Failed to save recipe ingredients' });
      throw error;
    }
  },

  loadTags: async () => {
    try {
      const { data } = await supabase.from('recipe_tags').select('name').order('name');
      set({ tags: data?.map((t) => t.name) || [] });
    } catch (error) {
      console.error('Failed to load tags:', error);
      set({ error: 'Failed to load tags' });
    }
  },

  deleteTag: async (tagName) => {
    try {
      const { error } = await supabase.from('recipe_tags').delete().eq('name', tagName);
      if (error) throw error;
      await get().loadTags();
    } catch (error) {
      console.error('Failed to delete tag:', error);
      set({ error: 'Failed to delete tag' });
      throw error;
    }
  },

  removeTagFromRecipe: async (recipeId, tagToRemove) => {
    try {
      const { recipes } = get();
      const recipe = recipes.find((r) => r.id === recipeId);
      if (recipe) {
        const newTags = recipe.tags.filter((tag) => tag !== tagToRemove);
        await get().updateRecipe(recipeId, { tags: newTags });
      }
    } catch (error) {
      console.error('Failed to remove tag:', error);
      set({ error: 'Failed to remove tag' });
      throw error;
    }
  },

  updateRecipeRating: async (recipeId, rating) => {
    try {
      await get().updateRecipe(recipeId, { rating });
    } catch (error) {
      console.error('Failed to update rating:', error);
      set({ error: 'Failed to update rating' });
      throw error;
    }
  },

  loadDeweyCategories: async () => {
    const { deweyCategoriesLoaded, deweyCategoriesLoading } = get();
    if (deweyCategoriesLoaded || deweyCategoriesLoading) return;

    set({ deweyCategoriesLoading: true });
    try {
      const { data, error } = await supabase
        .from('recipe_dewey_categories')
        .select('*')
        .order('dewey_code');

      if (error) throw error;

      set({
        deweyCategories: data || [],
        deweyCategoriesLoaded: true,
        deweyCategoriesLoading: false,
      });
    } catch (error) {
      console.error('Failed to load Dewey categories:', error);
      set({
        deweyCategoriesLoading: false,
        error: 'Failed to load Dewey categories',
      });
    }
  },

  getNextDeweySequence: async (baseCode) => {
    try {
      // Find existing recipes with this base code
      const { data } = await supabase
        .from('recipes')
        .select('dewey_decimal')
        .like('dewey_decimal', `${baseCode}.%`);

      const existingNumbers = (data || [])
        .map((r) => {
          const suffix = r.dewey_decimal?.substring(baseCode.length + 1);
          return suffix ? parseInt(suffix, 10) : 0;
        })
        .filter((n) => !isNaN(n));

      // Find next available number
      let nextNum = 1;
      while (existingNumbers.includes(nextNum)) {
        nextNum++;
      }

      return `${baseCode}.${nextNum.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Failed to get next Dewey sequence:', error);
      throw error;
    }
  },

  addDeweyCategory: async (category) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('recipe_dewey_categories')
        .insert({ ...category, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      const { deweyCategories } = get();
      set({ deweyCategories: [...deweyCategories, data] });
      return data;
    } catch (error) {
      console.error('Failed to add Dewey category:', error);
      set({ error: 'Failed to add Dewey category' });
      throw error;
    }
  },

  updateDeweyCategory: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('recipe_dewey_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const { deweyCategories } = get();
      set({
        deweyCategories: deweyCategories.map((cat) => (cat.id === id ? data : cat)),
      });
      return data;
    } catch (error) {
      console.error('Failed to update Dewey category:', error);
      set({ error: 'Failed to update Dewey category' });
      throw error;
    }
  },

  deleteDeweyCategory: async (id) => {
    try {
      const { error } = await supabase.from('recipe_dewey_categories').delete().eq('id', id);

      if (error) throw error;

      const { deweyCategories } = get();
      set({ deweyCategories: deweyCategories.filter((cat) => cat.id !== id) });
    } catch (error) {
      console.error('Failed to delete Dewey category:', error);
      set({ error: 'Failed to delete Dewey category' });
      throw error;
    }
  },

  getTagsWithCounts: async () => {
    try {
      const { data } = await supabase.from('recipe_tags').select(`
          name,
          recipe_tag_map(count)
        `);

      return (data || [])
        .map((t) => ({
          name: t.name,
          count: (t.recipe_tag_map as { count: number }[])?.[0]?.count || 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Failed to get tags with counts:', error);
      return [];
    }
  },

  uploadFile: async (recipeId, file) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const filePath = `${user.id}/${recipeId}/${Date.now()}-${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('recipe-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save metadata
      const { error: dbError } = await supabase.from('recipe_files').insert({
        recipe_id: recipeId,
        filename: file.name,
        file_path: filePath,
      });

      if (dbError) throw dbError;
    } catch (error) {
      console.error('Failed to upload file:', error);
      set({ error: 'Failed to upload file' });
      throw error;
    }
  },

  deleteFile: async (fileId) => {
    try {
      // Get file path
      const { data: fileData } = await supabase
        .from('recipe_files')
        .select('file_path')
        .eq('id', fileId)
        .single();

      if (fileData?.file_path) {
        // Delete from storage
        await supabase.storage.from('recipe-files').remove([fileData.file_path]);
      }

      // Delete metadata
      const { error } = await supabase.from('recipe_files').delete().eq('id', fileId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete file:', error);
      set({ error: 'Failed to delete file' });
      throw error;
    }
  },

  downloadFile: async (file) => {
    try {
      const { data, error } = await supabase.storage.from('recipe-files').download(file.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
      set({ error: 'Failed to download file' });
      throw error;
    }
  },
}));
