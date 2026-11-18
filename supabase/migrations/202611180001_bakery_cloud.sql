begin;

-- Staff are added by a project administrator, never through browser signup.
create table public.erp_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('management', 'employee'))
);
create table public.erp_state (
  id integer primary key check (id = 1),
  data jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.erp_state (id) values (1);
alter table public.erp_members enable row level security;
alter table public.erp_state enable row level security;
revoke all on public.erp_members, public.erp_state from anon, authenticated;
grant select on public.erp_members, public.erp_state to authenticated;
create policy own_membership on public.erp_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy staff_state on public.erp_state for select to authenticated
  using (exists (select 1 from public.erp_members where user_id = (select auth.uid())));

-- A locked version check prevents silent overwrites from another device.
create function public.erp_save(p_data jsonb, p_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  staff_role text;
  current_row public.erp_state%rowtype;
  old_count integer;
  new_count integer;
  position integer;
  entry jsonb;
begin
  select role into staff_role from public.erp_members where user_id = auth.uid();
  if staff_role is null then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_data) is distinct from 'object'
    or jsonb_typeof(p_data->'items') is distinct from 'array'
    or jsonb_typeof(p_data->'tx') is distinct from 'array'
    or jsonb_typeof(p_data->'sales') is distinct from 'array'
    or jsonb_typeof(p_data->'orders') is distinct from 'array' then
    raise exception 'Invalid bakery data' using errcode = '22023';
  end if;
  select * into current_row from public.erp_state where id = 1 for update;
  if p_version is distinct from current_row.version then
    raise exception 'ERP_CONFLICT: Another device saved changes. Reload before editing.' using errcode = '40001';
  end if;
  if staff_role = 'employee' then
    if current_row.data is null then
      raise exception 'Management must initialize the bakery first' using errcode = '42501';
    end if;
    if (p_data - 'tx') is distinct from (current_row.data - 'tx') then
      raise exception 'Employees may only add inventory transactions' using errcode = '42501';
    end if;
    old_count := jsonb_array_length(current_row.data->'tx');
    new_count := jsonb_array_length(p_data->'tx');
    if new_count < old_count or new_count > old_count + 500 then
      raise exception 'Invalid transaction append' using errcode = '42501';
    end if;
    if exists (
      select 1 from jsonb_array_elements(current_row.data->'tx') with ordinality as old_entry(value, n)
      where old_entry.value is distinct from p_data->'tx'->((old_entry.n-1)::integer)
    ) then
      raise exception 'Existing transactions cannot be changed' using errcode = '42501';
    end if;
    if new_count > old_count then
      for position in old_count..new_count-1 loop
        entry := p_data->'tx'->position;
        if jsonb_typeof(entry) is distinct from 'object'
          or coalesce(entry->>'type', '') not in ('prod','take','count')
          or entry->>'loc' is distinct from 'Main Fridge'
          or jsonb_typeof(entry->'qty') is distinct from 'number'
          or jsonb_typeof(entry->'item') is distinct from 'number' then
          raise exception 'Invalid inventory transaction' using errcode = '22023';
        end if;
        if (entry->>'qty')::numeric <> trunc((entry->>'qty')::numeric)
          or abs((entry->>'qty')::numeric) > 1000000000
          or (entry->>'item')::numeric <> trunc((entry->>'item')::numeric)
          or (entry->>'item')::numeric < 0
          or (entry->>'item')::numeric >= jsonb_array_length(p_data->'items')
          or (entry->>'type' = 'prod' and (entry->>'qty')::numeric <= 0)
          or (entry->>'type' = 'take' and (entry->>'qty')::numeric >= 0) then
          raise exception 'Invalid transaction quantity or product' using errcode = '22023';
        end if;
        -- The browser's typed employee name is a display label. Actor and time are authoritative.
        p_data := jsonb_set(p_data, array['tx',position::text], entry || jsonb_build_object(
          'actor_id',auth.uid(),'t',now()));
      end loop;
    end if;
  end if;
  update public.erp_state set data = p_data, version = version + 1,
    updated_at = now(), updated_by = auth.uid() where id = 1 returning * into current_row;
  return to_jsonb(current_row);
end;
$$;
revoke all on function public.erp_save(jsonb,bigint) from public, anon;
grant execute on function public.erp_save(jsonb,bigint) to authenticated;
commit;
