-- Separate daily counters for:
--   chat_photo  — chat + Progress Photos "send to friends" (Supabase chat-images)
--   photo       — profile media, food scan, and other non-chat photo uploads
--
-- Local-only Progress Photos (IndexedDB) never call these RPCs; this migration
-- only clarifies server-side accounting so chat-line uploads do not share the
-- same daily bucket as unrelated `photo` uploads.

alter table public.media_daily_usage
  drop constraint if exists media_daily_usage_media_type_check;

alter table public.media_daily_usage
  add constraint media_daily_usage_media_type_check
  check (media_type in ('photo', 'video', 'audio', 'chat_photo'));

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
    when 'chat_photo' then v_limit := 50; v_max_size := 25;
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
  if media_type not in ('photo', 'video', 'audio', 'chat_photo') then
    return;
  end if;

  insert into public.media_daily_usage (user_id, day, media_type, count, updated_at)
  values (increment_media_count.user_id, v_today, increment_media_count.media_type, 1, now())
  on conflict (user_id, day, media_type) do update
    set count      = public.media_daily_usage.count + 1,
        updated_at = now();
end;
$$;

comment on function public.check_media_limits(uuid, text, numeric) is
  'Daily upload guardrails. chat_photo = chat / progress-photo shares (50/day, 25MB). photo = other photo uploads (50/day, 25MB). video/audio unchanged.';
