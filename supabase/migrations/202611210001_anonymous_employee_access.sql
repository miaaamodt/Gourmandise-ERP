-- Employee access uses Supabase anonymous users; no public database role is granted.
-- The auth.users trigger creates a least-privilege employee membership for anonymous sign-ins.
begin;

create or replace function public.erp_assign_anonymous_employee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_anonymous then
    insert into public.erp_members (user_id, role)
      values (new.id, 'employee')
      on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.erp_assign_anonymous_employee() from public, anon, authenticated;

drop trigger if exists erp_assign_anonymous_employee on auth.users;
create trigger erp_assign_anonymous_employee
  after insert on auth.users
  for each row execute function public.erp_assign_anonymous_employee();

commit;
