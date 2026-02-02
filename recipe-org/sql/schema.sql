-- Recipe Organizer Schema for Supabase
-- Run this in Supabase SQL Editor

-- Tags table
create table if not exists tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now() not null,
  unique(user_id, name)
);

-- Dewey categories table
create table if not exists dewey_categories (
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
  notes text,
  rating integer check (rating >= 1 and rating <= 5),
  dewey_decimal text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Recipe tags junction table
create table if not exists recipe_tags (
  recipe_id uuid references recipes(id) on delete cascade not null,
  tag_id uuid references tags(id) on delete cascade not null,
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
create index if not exists idx_tags_user_id on tags(user_id);
create index if not exists idx_dewey_categories_user_id on dewey_categories(user_id);
create index if not exists idx_dewey_categories_parent_code on dewey_categories(parent_code);
create index if not exists idx_recipe_tags_recipe_id on recipe_tags(recipe_id);
create index if not exists idx_recipe_tags_tag_id on recipe_tags(tag_id);
create index if not exists idx_recipe_files_recipe_id on recipe_files(recipe_id);

-- Row Level Security (RLS)
alter table tags enable row level security;
alter table dewey_categories enable row level security;
alter table recipes enable row level security;
alter table recipe_tags enable row level security;
alter table recipe_files enable row level security;

-- Tags policies
create policy "Users can view own tags"
  on tags for select
  using (auth.uid() = user_id);

create policy "Users can insert own tags"
  on tags for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tags"
  on tags for update
  using (auth.uid() = user_id);

create policy "Users can delete own tags"
  on tags for delete
  using (auth.uid() = user_id);

-- Dewey categories policies
create policy "Users can view own dewey categories"
  on dewey_categories for select
  using (auth.uid() = user_id);

create policy "Users can insert own dewey categories"
  on dewey_categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update own dewey categories"
  on dewey_categories for update
  using (auth.uid() = user_id);

create policy "Users can delete own dewey categories"
  on dewey_categories for delete
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

-- Recipe tags policies (check via recipe ownership)
create policy "Users can view own recipe tags"
  on recipe_tags for select
  using (exists (
    select 1 from recipes where recipes.id = recipe_tags.recipe_id and recipes.user_id = auth.uid()
  ));

create policy "Users can insert own recipe tags"
  on recipe_tags for insert
  with check (exists (
    select 1 from recipes where recipes.id = recipe_tags.recipe_id and recipes.user_id = auth.uid()
  ));

create policy "Users can delete own recipe tags"
  on recipe_tags for delete
  using (exists (
    select 1 from recipes where recipes.id = recipe_tags.recipe_id and recipes.user_id = auth.uid()
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
-- Run this separately in Supabase Dashboard > Storage
-- Or via SQL:
-- insert into storage.buckets (id, name, public) values ('recipe-files', 'recipe-files', false);

-- Storage policies (run after creating bucket)
-- create policy "Users can upload recipe files"
--   on storage.objects for insert
--   with check (bucket_id = 'recipe-files' and auth.uid()::text = (storage.foldername(name))[1]);

-- create policy "Users can view own recipe files"
--   on storage.objects for select
--   using (bucket_id = 'recipe-files' and auth.uid()::text = (storage.foldername(name))[1]);

-- create policy "Users can delete own recipe files"
--   on storage.objects for delete
--   using (bucket_id = 'recipe-files' and auth.uid()::text = (storage.foldername(name))[1]);
