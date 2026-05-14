-- ============================================================
-- MacroSnap — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create the logs table
create table if not exists public.logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,                          -- nullable (no auth for now)
  food_name  text not null,
  calories   integer not null default 0,
  protein    real not null default 0,
  carbs      real not null default 0,
  fats       real not null default 0,
  image_url  text,
  created_at timestamptz not null default now()
);

-- 2. Enable Row Level Security (open access since no auth)
alter table public.logs enable row level security;

-- Allow anyone to read, insert, and delete (no auth)
create policy "Allow public read"   on public.logs for select using (true);
create policy "Allow public insert" on public.logs for insert with check (true);
create policy "Allow public delete" on public.logs for delete using (true);

-- 3. Create the meal-images storage bucket
insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

-- Allow public uploads to the meal-images bucket
create policy "Allow public upload" on storage.objects
  for insert with check (bucket_id = 'meal-images');

create policy "Allow public read storage" on storage.objects
  for select using (bucket_id = 'meal-images');
