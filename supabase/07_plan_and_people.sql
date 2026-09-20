-- =====================================================================
-- AFAMS — buying plan (regular purchases) + driver / operator names
-- Run once, after 06_grouping.sql. Safe to run again.
-- =====================================================================

-- Who uses the asset. Free text, because drivers and operators don't log in.
-- Vehicles: driver + co-driver. Machinery: operator + assistant operator.
alter table assets
  add column if not exists driver_name    text,
  add column if not exists co_driver_name text;

-- A standing plan, e.g. "1 tyre a month, alternating Mguu Kumi and Mguu Sita"
create table if not exists purchase_plans (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(trim(name)) > 2),
  spare_part_id       uuid references spare_parts(id),
  description         text not null check (length(trim(description)) > 1),
  quantity            numeric(12,2) not null check (quantity > 0),
  cycle_months        integer not null default 1 check (cycle_months between 1 and 24),
  estimated_unit_cost numeric(14,2) check (estimated_unit_cost is null or estimated_unit_cost >= 0),
  supplier_id         uuid references suppliers(id),
  asset_ids           uuid[] not null default '{}',   -- vehicles it is for, in rotation order
  next_asset_index    integer not null default 0,     -- whose turn it is
  next_due_date       date not null default nairobi_today(),
  last_requested_at   timestamptz,
  notes               text,
  is_active           boolean not null default true,
  created_by          uuid references profiles(id) default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists purchase_plans_due_idx on purchase_plans (next_due_date) where is_active;

alter table purchase_plans enable row level security;
drop policy if exists plans_read   on purchase_plans;
drop policy if exists plans_insert on purchase_plans;
drop policy if exists plans_update on purchase_plans;
create policy plans_read   on purchase_plans for select to authenticated using (is_active_user());
create policy plans_insert on purchase_plans for insert to authenticated with check (has_role('admin','stores','fleet'));
create policy plans_update on purchase_plans for update to authenticated
  using (has_role('admin','stores','fleet')) with check (has_role('admin','stores','fleet'));

drop trigger if exists audit_purchase_plans on purchase_plans;
create trigger audit_purchase_plans after insert or update on purchase_plans
  for each row execute function public.audit_row();

-- Turn a plan into a draft purchase request, then move the plan to the next cycle
-- and hand the turn to the next vehicle.
create or replace function public.create_request_from_plan(p_plan_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pl purchase_plans%rowtype;
  v_pr uuid; v_number text;
  v_count integer; v_asset uuid; v_asset_name text;
begin
  if not has_role('admin','stores','fleet') then raise exception 'NOT_AUTHORISED'; end if;
  select * into pl from purchase_plans where id = p_plan_id for update;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;
  if not pl.is_active then raise exception 'PLAN_PAUSED'; end if;

  v_count := coalesce(array_length(pl.asset_ids, 1), 0);
  if v_count > 0 then
    v_asset := pl.asset_ids[(pl.next_asset_index % v_count) + 1];
    select name into v_asset_name from assets where id = v_asset;
  end if;

  insert into purchase_requests (justification, supplier_id, needed_by)
  values ('Buying plan: ' || pl.name || coalesce(' — for ' || v_asset_name, ''), pl.supplier_id, pl.next_due_date)
  returning id, request_number into v_pr, v_number;

  insert into purchase_request_items (purchase_request_id, spare_part_id, description, quantity, estimated_unit_cost, asset_id)
  values (v_pr, pl.spare_part_id, pl.description, pl.quantity, pl.estimated_unit_cost, v_asset);

  update purchase_plans
     set next_due_date     = (greatest(nairobi_today(), next_due_date) + make_interval(months => cycle_months))::date,
         next_asset_index  = case when v_count > 0 then (next_asset_index + 1) % v_count else 0 end,
         last_requested_at = now(),
         updated_at        = now()
   where id = p_plan_id;

  return jsonb_build_object('status','saved','request_id', v_pr, 'request_number', v_number, 'for_asset', v_asset_name);
end $$;

-- Skip this cycle without buying (e.g. "tyres still fine this month")
create or replace function public.skip_plan_cycle(p_plan_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare pl purchase_plans%rowtype;
begin
  if not has_role('admin','stores','fleet') then raise exception 'NOT_AUTHORISED'; end if;
  select * into pl from purchase_plans where id = p_plan_id for update;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;
  update purchase_plans
     set next_due_date = (greatest(nairobi_today(), next_due_date) + make_interval(months => cycle_months))::date,
         updated_at = now()
   where id = p_plan_id;
  return jsonb_build_object('status','saved');
end $$;

revoke all on function public.create_request_from_plan(uuid) from public, anon;
revoke all on function public.skip_plan_cycle(uuid) from public, anon;
grant execute on function public.create_request_from_plan(uuid) to authenticated;
grant execute on function public.skip_plan_cycle(uuid) to authenticated;

-- Plans with their part, and whose turn it is
create or replace view v_purchase_plans with (security_invoker = true) as
select pl.*,
       sp.name as part_name, sp.unit as part_unit, sp.current_stock,
       s.name  as supplier_name,
       pl.next_due_date - nairobi_today() as days_until_due,
       na.id   as next_asset_id,
       na.name as next_asset_name,
       (select coalesce(array_agg(a.name order by x.ord), '{}')
          from unnest(pl.asset_ids) with ordinality as x(aid, ord)
          join assets a on a.id = x.aid) as asset_names
from purchase_plans pl
left join spare_parts sp on sp.id = pl.spare_part_id
left join suppliers   s  on s.id  = pl.supplier_id
left join assets na on na.id = case when coalesce(array_length(pl.asset_ids, 1), 0) > 0
                                    then pl.asset_ids[(pl.next_asset_index % array_length(pl.asset_ids, 1)) + 1] end;
