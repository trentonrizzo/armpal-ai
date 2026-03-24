create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Delete user-owned rows from every public table that has a user_id column.
  for r in
    select c.table_schema, c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'user_id'
      and c.table_name <> 'profiles'
  loop
    execute format('delete from %I.%I where user_id = $1', r.table_schema, r.table_name)
      using v_uid;
  end loop;

  -- Profile row is keyed by auth user id.
  delete from public.profiles where id = v_uid;

  -- Fully remove auth user.
  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
