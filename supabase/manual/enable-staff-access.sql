-- Run once in the Supabase SQL Editor before activating staff mode.
-- Replace MANAGER_EMAIL_HERE with the existing Authentication user's email.
-- No passwords or private keys belong in this query or in GitHub.
begin;
lock table public.erp_state, public.erp_preview_state in access exclusive mode;

do $$
declare
  manager_id uuid;
  testing_data jsonb;
  staff_data jsonb;
begin
  select id into manager_id from auth.users
    where lower(email) = lower('MANAGER_EMAIL_HERE');
  if manager_id is null then
    raise exception 'The management email was not found in Authentication → Users. No changes were applied.';
  end if;
  select data into testing_data from public.erp_preview_state where id = 1;
  if testing_data is null then
    raise exception 'The shared testing data is missing or uninitialized. No changes were applied.';
  end if;
  select data into staff_data from public.erp_state where id = 1;
  if not found then
    raise exception 'The staff database row is missing. No changes were applied.';
  end if;
  if staff_data is not null and staff_data is distinct from testing_data then
    raise exception 'Staff storage already contains different data. Stopped to avoid overwriting it. Ask for a data review.';
  end if;
  insert into public.erp_members (user_id, role)
    values (manager_id, 'management')
    on conflict (user_id) do update set role = excluded.role;
  update public.erp_state
    set data = testing_data, version = version + 1,
        updated_at = now(), updated_by = manager_id
    where id = 1 and data is null;
end;
$$;

-- Keep the old copy for backup, but close both its public read and write paths.
revoke all on public.erp_preview_state from public, anon, authenticated;
revoke all on function public.erp_preview_save(jsonb,bigint) from public, anon, authenticated;
drop policy if exists public_testing_read on public.erp_preview_state;
revoke all on public.erp_state, public.erp_members from anon;
revoke all on function public.erp_save(jsonb,bigint) from public, anon;
commit;
