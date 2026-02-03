export interface RecipeFile {
  id: string;
  recipe_id: string;
  filename: string;
  file_path: string;
  created_at: string;
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
}

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
