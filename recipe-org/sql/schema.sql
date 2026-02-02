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
