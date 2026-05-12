-- Adjust the daily media-upload limits so that normal users (especially those
-- sharing Progress Photos through chat) don't run into restrictions during
-- everyday use, while still keeping baseline abuse protection in place.
--
-- This migration installs a clean, source-controlled implementation of the
-- functions the app already calls:
--   - public.check_media_limits(user_id, media_type, file_size_mb) -> boolean
--   - public.increment_media_count(user_id, media_type)            -> void
--
-- Limits per user per UTC day:
--   photo : 50 uploads, 25 MB max each
--   video : 5  uploads, 100 MB max each
--   audio : 30 uploads, 10 MB max each
--
-- Counters live in a dedicated table so the rules are visible and tunable.

-- ----------------------------------------------------------------------------
-- Usage table
-- ----------------------------------------------------------------------------
create table if not exists public.media_daily_usage (
  user_id     uuid    not null,
  day         date    not null,
  media_type  text    not null check (media_type in ('photo', 'video', 'audio')),
  count       integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, day, media_type)
);

create index if not exists media_daily_usage_user_day_idx
  on public.media_daily_usage (user_id, day);

alter table public.media_daily_usage enable row level security;

drop policy if exists "media_daily_usage_select_own" on public.media_daily_usage;
create policy "media_daily_usage_select_own"
  on public.media_daily_usage for select
  using (auth.uid() = user_id);

drop policy if exists "media_daily_usage_service_all" on public.media_daily_usage;
create policy "media_daily_usage_service_all"
  on public.media_daily_usage for all
  using (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- check_media_limits: returns true if the user may upload one more item of
-- the given media_type today, and the file size is within the per-file cap.
-- ----------------------------------------------------------------------------
create or replace function public.check_media_limits(
  user_id      uuid,
  media_type   text,
  file_size_mb numeric
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit    int;
  v_max_size numeric;
  v_count    int := 0;
  v_today    date := (now() at time zone 'utc')::date;
begin
  if user_id is null or media_type is null then
    return false;
  end if;

  case media_type
    when 'photo' then v_limit := 50; v_max_size := 25;
    when 'video' then v_limit := 5;  v_max_size := 100;
    when 'audio' then v_limit := 30; v_max_size := 10;
    else return false;
  end case;

  if coalesce(file_size_mb, 0) > v_max_size then
    return false;
  end if;

  select coalesce(u.count, 0)
    into v_count
    from public.media_daily_usage u
   where u.user_id    = check_media_limits.user_id
     and u.day        = v_today
     and u.media_type = check_media_limits.media_type;

  return v_count < v_limit;
end;
$$;

-- ----------------------------------------------------------------------------
-- increment_media_count: bump today's counter for the given media_type.
-- Called by the client after a successful upload.
-- ----------------------------------------------------------------------------
create or replace function public.increment_media_count(
  user_id    uuid,
  media_type text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
begin
  if user_id is null or media_type is null then
    return;
  end if;
  if media_type not in ('photo', 'video', 'audio') then
    return;
  end if;

  insert into public.media_daily_usage (user_id, day, media_type, count, updated_at)
  values (increment_media_count.user_id, v_today, increment_media_count.media_type, 1, now())
  on conflict (user_id, day, media_type) do update
    set count      = public.media_daily_usage.count + 1,
        updated_at = now();
end;
$$;

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------
revoke all on function public.check_media_limits(uuid, text, numeric) from public;
revoke all on function public.increment_media_count(uuid, text)       from public;

grant execute on function public.check_media_limits(uuid, text, numeric) to authenticated;
grant execute on function public.increment_media_count(uuid, text)       to authenticated;

comment on function public.check_media_limits(uuid, text, numeric) is
  'Daily upload guardrails: photo 50/day (25MB), video 5/day (100MB), audio 30/day (10MB). Tunable here.';
comment on function public.increment_media_count(uuid, text) is
  'Increments today''s counter in media_daily_usage after a successful upload.';
