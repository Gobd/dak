-- Run this once in the existing Recipe Organizer Supabase project.
-- It adds structured, user-owned nutrition data without changing recipe text.

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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
  for each row execute function update_updated_at_column();

drop trigger if exists update_recipe_ingredient_nutrition_updated_at on recipe_ingredient_nutrition;
create trigger update_recipe_ingredient_nutrition_updated_at
  before update on recipe_ingredient_nutrition
  for each row execute function update_updated_at_column();

drop trigger if exists update_recipe_ingredient_lines_updated_at on recipe_ingredient_lines;
create trigger update_recipe_ingredient_lines_updated_at
  before update on recipe_ingredient_lines
  for each row execute function update_updated_at_column();
