begin;

-- A public testing copy, separate from the staff-only production data.
create table public.erp_preview_state (
  id integer primary key check (id = 1),
  data jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.erp_preview_state (id) values (1);
alter table public.erp_preview_state enable row level security;
revoke all on public.erp_preview_state from anon, authenticated;
grant select on public.erp_preview_state to anon, authenticated;
create policy public_testing_read on public.erp_preview_state
  for select to anon, authenticated using (true);

create function public.erp_preview_save(p_data jsonb, p_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.erp_preview_state%rowtype;
begin
  if jsonb_typeof(p_data) is distinct from 'object'
    or jsonb_typeof(p_data->'items') is distinct from 'array'
    or jsonb_typeof(p_data->'tx') is distinct from 'array'
    or jsonb_typeof(p_data->'sales') is distinct from 'array'
    or jsonb_typeof(p_data->'orders') is distinct from 'array'
    or octet_length(p_data::text) > 10000000 then
    raise exception 'Invalid bakery testing data' using errcode = '22023';
  end if;
  select * into current_row from public.erp_preview_state where id = 1 for update;
  if p_version is distinct from current_row.version then
    raise exception 'ERP_CONFLICT: Someone else saved first. Download your unsaved copy, then reload.' using errcode = '40001';
  end if;
  update public.erp_preview_state set data=p_data, version=version+1, updated_at=now()
    where id=1 returning * into current_row;
  return to_jsonb(current_row);
end;
$$;
revoke all on function public.erp_preview_save(jsonb,bigint) from public;
grant execute on function public.erp_preview_save(jsonb,bigint) to anon, authenticated;
commit;
