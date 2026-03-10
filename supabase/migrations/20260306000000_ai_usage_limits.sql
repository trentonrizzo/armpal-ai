-- AI usage limits per user per day
create table if not exists ai_usage (
  user_id uuid not null,
  date date not null,
  chat_responses integer not null default 0,
  workout_converts integer not null default 0,
  image_scans integer not null default 0,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table ai_usage enable row level security;

create policy "Users can see own ai_usage"
  on ai_usage for select
  using (auth.uid() = user_id);

create policy "Service role can manage ai_usage"
  on ai_usage for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function ai_usage_set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ai_usage_set_timestamp on ai_usage;
create trigger ai_usage_set_timestamp before update on ai_usage
for each row execute procedure ai_usage_set_timestamp();

