-- Recipe Organizer Schema for Supabase
-- Run this in Supabase SQL Editor

-- Recipe tags table
create table if not exists recipe_tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now() not null,
  unique(user_id, name)
);

-- Recipe Dewey categories table
create table if not exists recipe_dewey_categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  dewey_code text not null,
  name text not null,
  level integer not null default 1,
  parent_code text,
  is_active boolean not null default true,
  created_at timestamptz default now() not null,
  unique(user_id, dewey_code)
);

-- Recipes table
create table if not exists recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  page text,
  url text,
  recipe text,
  notes text,
  rating integer check (rating >= 1 and rating <= 5),
  dewey_decimal text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Recipe tag map junction table
create table if not exists recipe_tag_map (
  recipe_id uuid references recipes(id) on delete cascade not null,
  tag_id uuid references recipe_tags(id) on delete cascade not null,
  primary key (recipe_id, tag_id)
);

-- Recipe files table (metadata only - files stored in Supabase Storage)
create table if not exists recipe_files (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references recipes(id) on delete cascade not null,
  filename text not null,
  file_path text not null,
  created_at timestamptz default now() not null
);

-- Indexes for performance
create index if not exists idx_recipes_user_id on recipes(user_id);
create index if not exists idx_recipes_dewey_decimal on recipes(dewey_decimal);
create index if not exists idx_recipe_tags_user_id on recipe_tags(user_id);
create index if not exists idx_recipe_dewey_categories_user_id on recipe_dewey_categories(user_id);
create index if not exists idx_recipe_dewey_categories_parent_code on recipe_dewey_categories(parent_code);
create index if not exists idx_recipe_tag_map_recipe_id on recipe_tag_map(recipe_id);
create index if not exists idx_recipe_tag_map_tag_id on recipe_tag_map(tag_id);
create index if not exists idx_recipe_files_recipe_id on recipe_files(recipe_id);

-- Row Level Security (RLS)
alter table recipe_tags enable row level security;
alter table recipe_dewey_categories enable row level security;
alter table recipes enable row level security;
alter table recipe_tag_map enable row level security;
alter table recipe_files enable row level security;

-- Recipe tags policies
create policy "Users can view own recipe tags"
  on recipe_tags for select
  using (auth.uid() = user_id);

create policy "Users can insert own recipe tags"
  on recipe_tags for insert
  with check (auth.uid() = user_id);

create policy "Users can update own recipe tags"
  on recipe_tags for update
  using (auth.uid() = user_id);

create policy "Users can delete own recipe tags"
  on recipe_tags for delete
  using (auth.uid() = user_id);

-- Recipe Dewey categories policies
create policy "Users can view own recipe dewey categories"
  on recipe_dewey_categories for select
  using (auth.uid() = user_id);

create policy "Users can insert own recipe dewey categories"
  on recipe_dewey_categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update own recipe dewey categories"
  on recipe_dewey_categories for update
  using (auth.uid() = user_id);

create policy "Users can delete own recipe dewey categories"
  on recipe_dewey_categories for delete
  using (auth.uid() = user_id);

-- Recipes policies
create policy "Users can view own recipes"
  on recipes for select
  using (auth.uid() = user_id);

create policy "Users can insert own recipes"
  on recipes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own recipes"
  on recipes for update
  using (auth.uid() = user_id);

create policy "Users can delete own recipes"
  on recipes for delete
  using (auth.uid() = user_id);

-- Recipe tag map policies (check via recipe ownership)
create policy "Users can view own recipe tag map"
  on recipe_tag_map for select
  using (exists (
    select 1 from recipes where recipes.id = recipe_tag_map.recipe_id and recipes.user_id = auth.uid()
  ));

create policy "Users can insert own recipe tag map"
  on recipe_tag_map for insert
  with check (exists (
    select 1 from recipes where recipes.id = recipe_tag_map.recipe_id and recipes.user_id = auth.uid()
  ));

create policy "Users can delete own recipe tag map"
  on recipe_tag_map for delete
  using (exists (
    select 1 from recipes where recipes.id = recipe_tag_map.recipe_id and recipes.user_id = auth.uid()
  ));

-- Recipe files policies
create policy "Users can view own recipe files"
  on recipe_files for select
  using (exists (
    select 1 from recipes where recipes.id = recipe_files.recipe_id and recipes.user_id = auth.uid()
  ));

create policy "Users can insert own recipe files"
  on recipe_files for insert
  with check (exists (
    select 1 from recipes where recipes.id = recipe_files.recipe_id and recipes.user_id = auth.uid()
  ));

create policy "Users can delete own recipe files"
  on recipe_files for delete
  using (exists (
    select 1 from recipes where recipes.id = recipe_files.recipe_id and recipes.user_id = auth.uid()
  ));

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for recipes updated_at
create trigger update_recipes_updated_at
  before update on recipes
  for each row
  execute function update_updated_at_column();

-- Storage bucket for recipe files
insert into storage.buckets (id, name, public)
values ('recipe-files', 'recipe-files', false)
on conflict (id) do nothing;

-- Storage policies
drop policy if exists "Users can upload recipe files" on storage.objects;
create policy "Users can upload recipe files"
  on storage.objects for insert
  with check (bucket_id = 'recipe-files' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can view own recipe files" on storage.objects;
create policy "Users can view own recipe files"
  on storage.objects for select
  using (bucket_id = 'recipe-files' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete own recipe files" on storage.objects;
create policy "Users can delete own recipe files"
  on storage.objects for delete
  using (bucket_id = 'recipe-files' and auth.uid()::text = (storage.foldername(name))[1]);

--------------------------------------------------------------------------------
-- Structured nutrition data
--------------------------------------------------------------------------------

-- One reusable ingredient name per user. Nutrition values live in the
-- child table because the same ingredient may have values per gram, ounce,
-- cup, tablespoon, etc.
create table if not exists recipe_ingredients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create unique index if not exists idx_recipe_ingredients_user_name
  on recipe_ingredients (user_id, lower(name));

create table if not exists recipe_ingredient_nutrition (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ingredient_id uuid references recipe_ingredients(id) on delete cascade not null,
  unit text not null check (unit in ('g', 'kg', 'oz', 'lb', 'ml', 'tsp', 'tbsp', 'cup', 'each')),
  calories numeric(12, 4) not null default 0 check (calories >= 0),
  protein_g numeric(12, 4) not null default 0 check (protein_g >= 0),
  fiber_g numeric(12, 4) not null default 0 check (fiber_g >= 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (ingredient_id, unit)
);

create table if not exists recipe_ingredient_lines (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  recipe_id uuid references recipes(id) on delete cascade not null,
  ingredient_id uuid references recipe_ingredients(id) on delete restrict not null,
  amount numeric(12, 4) not null check (amount > 0),
  unit text not null check (unit in ('g', 'kg', 'oz', 'lb', 'ml', 'tsp', 'tbsp', 'cup', 'each')),
  sort_order integer not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_recipe_ingredients_user_id on recipe_ingredients(user_id);
create index if not exists idx_recipe_ingredient_nutrition_ingredient_id
  on recipe_ingredient_nutrition(ingredient_id);
create index if not exists idx_recipe_ingredient_nutrition_user_id
  on recipe_ingredient_nutrition(user_id);
create index if not exists idx_recipe_ingredient_lines_recipe_id
  on recipe_ingredient_lines(recipe_id, sort_order);
create index if not exists idx_recipe_ingredient_lines_user_id
  on recipe_ingredient_lines(user_id);

alter table recipe_ingredients enable row level security;
alter table recipe_ingredient_nutrition enable row level security;
alter table recipe_ingredient_lines enable row level security;

drop policy if exists "Users can manage own recipe ingredients" on recipe_ingredients;
create policy "Users can manage own recipe ingredients"
  on recipe_ingredients for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own ingredient nutrition" on recipe_ingredient_nutrition;
create policy "Users can manage own ingredient nutrition"
  on recipe_ingredient_nutrition for all
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from recipe_ingredients
      where recipe_ingredients.id = recipe_ingredient_nutrition.ingredient_id
        and recipe_ingredients.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from recipe_ingredients
      where recipe_ingredients.id = recipe_ingredient_nutrition.ingredient_id
        and recipe_ingredients.user_id = auth.uid()
    )
  );

drop policy if exists "Users can manage own recipe ingredient lines" on recipe_ingredient_lines;
create policy "Users can manage own recipe ingredient lines"
  on recipe_ingredient_lines for all
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from recipes
      where recipes.id = recipe_ingredient_lines.recipe_id
        and recipes.user_id = auth.uid()
    )
    and exists (
      select 1 from recipe_ingredients
      where recipe_ingredients.id = recipe_ingredient_lines.ingredient_id
        and recipe_ingredients.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from recipes
      where recipes.id = recipe_ingredient_lines.recipe_id
        and recipes.user_id = auth.uid()
    )
    and exists (
      select 1 from recipe_ingredients
      where recipe_ingredients.id = recipe_ingredient_lines.ingredient_id
        and recipe_ingredients.user_id = auth.uid()
    )
  );

drop trigger if exists update_recipe_ingredients_updated_at on recipe_ingredients;
create trigger update_recipe_ingredients_updated_at
  before update on recipe_ingredients
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_recipe_ingredient_nutrition_updated_at on recipe_ingredient_nutrition;
create trigger update_recipe_ingredient_nutrition_updated_at
  before update on recipe_ingredient_nutrition
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_recipe_ingredient_lines_updated_at on recipe_ingredient_lines;
create trigger update_recipe_ingredient_lines_updated_at
  before update on recipe_ingredient_lines
  for each row
  execute function update_updated_at_column();
