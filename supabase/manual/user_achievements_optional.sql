-- =============================================================================
-- OPTIONAL: ArmPal user achievements (Supabase)
-- Apply manually in SQL Editor or `supabase db execute` when you want cloud sync.
-- The app falls back to IndexedDB (localforage) if this table is missing or RLS blocks.
-- =============================================================================

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  constraint user_achievements_user_achievement unique (user_id, achievement_id)
);

create index if not exists user_achievements_user_id_idx on public.user_achievements (user_id);
create index if not exists user_achievements_unlocked_at_idx on public.user_achievements (unlocked_at desc);

alter table public.user_achievements enable row level security;

-- Read own rows
drop policy if exists "user_achievements_select_own" on public.user_achievements;
create policy "user_achievements_select_own" on public.user_achievements
  for select to authenticated
  using (auth.uid() = user_id);

-- Insert own rows
drop policy if exists "user_achievements_insert_own" on public.user_achievements;
create policy "user_achievements_insert_own" on public.user_achievements
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Optional: allow users to delete their own (not used by app today)
drop policy if exists "user_achievements_delete_own" on public.user_achievements;
create policy "user_achievements_delete_own" on public.user_achievements
  for delete to authenticated
  using (auth.uid() = user_id);

comment on table public.user_achievements is 'ArmPal achievement unlocks; client may also mirror to local storage.';
