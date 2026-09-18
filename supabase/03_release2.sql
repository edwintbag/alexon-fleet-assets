-- =====================================================================
-- AFAMS Release 2 — breakdowns, spare parts, stock and purchasing
-- Run once, after 01_schema.sql (and 02_seed). SQL Editor → Run.
-- =====================================================================

create type breakdown_severity as enum ('critical','major','minor');
create type breakdown_status   as enum ('reported','in_progress','awaiting_parts','resolved');
create type movement_type      as enum ('opening_balance','purchase_receipt','service_issue','breakdown_issue',
                                        'adjustment_in','adjustment_out','return_to_stock','write_off');
create type pr_status          as enum ('draft','submitted','approved','rejected','ordered','received','cancelled');

-- ---------------------------------------------------------------------
-- Numbering: BD-2026-0001, PR-2026-0001
-- ---------------------------------------------------------------------
create table document_sequences (
  key        text primary key,
  last_value integer not null default 0
);

create or replace function public.next_number(p_prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare v_year text := to_char(nairobi_today(), 'YYYY'); v_key text; v_n integer;
begin
  v_key := p_prefix || ':' || v_year;
  insert into document_sequences (key, last_value) values (v_key, 1)
  on conflict (key) do update set last_value = document_sequences.last_value + 1
  returning last_value into v_n;
  return p_prefix || '-' || v_year || '-' || lpad(v_n::text, 4, '0');
end $$;

-- ---------------------------------------------------------------------
-- Breakdowns
-- ---------------------------------------------------------------------
create table breakdowns (
  id               uuid primary key default gen_random_uuid(),
  breakdown_number text unique not null default next_number('BD'),
  asset_id         uuid not null references assets(id),
  reported_at      timestamptz not null default now(),
  reported_by      uuid references profiles(id) default auth.uid(),
  location         text,
  description      text not null check (length(trim(description)) > 2),
  severity         breakdown_severity not null default 'major',
  asset_operable   boolean not null default false,
  meter_reading    numeric(12,1),
  status           breakdown_status not null default 'reported',
  assigned_to      uuid references profiles(id),
  resolution_notes text,
  repair_cost      numeric(14,2) check (repair_cost is null or repair_cost >= 0),
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status <> 'resolved' or (resolved_at is not null and length(trim(coalesce(resolution_notes,''))) > 2))
);
create index breakdowns_asset_idx on breakdowns (asset_id, reported_at desc);
create index breakdowns_open_idx on breakdowns (status) where status <> 'resolved';

-- ---------------------------------------------------------------------
-- Suppliers and spare parts
-- ---------------------------------------------------------------------
create table suppliers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique check (length(trim(name)) > 1),
  contact_person text,
  phone          text,
  email          text,
  supplies       text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table spare_parts (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(trim(name)) > 1),
  part_number      text,
  category         text,
  unit             text not null default 'pcs',
  current_stock    numeric(12,2) not null default 0 check (current_stock >= 0),
  minimum_stock    numeric(12,2) not null default 0 check (minimum_stock >= 0),
  reorder_quantity numeric(12,2) check (reorder_quantity is null or reorder_quantity > 0),
  average_cost     numeric(14,2) not null default 0,
  supplier_id      uuid references suppliers(id),
  location         text,
  notes            text,
  archived_at      timestamptz,
  created_by       uuid references profiles(id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index spare_parts_number_unique on spare_parts (lower(part_number)) where part_number is not null and archived_at is null;
create index spare_parts_low_idx on spare_parts (current_stock) where archived_at is null;

create or replace function public.parts_guard() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.current_stock is distinct from old.current_stock
     and coalesce(current_setting('afams.stock_write', true), '') <> 'on' and auth.uid() is not null then
    raise exception 'USE_STOCK_MOVEMENT';
  end if;
  return new;
end $$;
create trigger spare_parts_guard before insert or update on spare_parts
  for each row execute function public.parts_guard();

create table part_stock_movements (
  id              uuid primary key default gen_random_uuid(),
  spare_part_id   uuid not null references spare_parts(id),
  movement_type   movement_type not null,
  quantity        numeric(12,2) not null check (quantity <> 0),   -- + in, − out
  balance_after   numeric(12,2) not null check (balance_after >= 0),
  unit_cost       numeric(14,2),
  asset_id        uuid references assets(id),
  reference       text,
  reason          text,
  idempotency_key uuid not null unique,
  created_by      uuid references profiles(id) default auth.uid(),
  created_at      timestamptz not null default now()
);
create index movements_part_idx on part_stock_movements (spare_part_id, created_at desc);

-- ---------------------------------------------------------------------
-- Purchase requests
-- ---------------------------------------------------------------------
create table purchase_requests (
  id               uuid primary key default gen_random_uuid(),
  request_number   text unique not null default next_number('PR'),
  status           pr_status not null default 'draft',
  supplier_id      uuid references suppliers(id),
  needed_by        date,
  justification    text,
  requested_by     uuid references profiles(id) default auth.uid(),
  approved_by      uuid references profiles(id),
  approved_at      timestamptz,
  ordered_at       timestamptz,
  received_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (approved_by is null or approved_by <> requested_by)
);
create index pr_status_idx on purchase_requests (status);

create table purchase_request_items (
  id                  uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null references purchase_requests(id) on delete cascade,
  spare_part_id       uuid references spare_parts(id),
  description         text not null check (length(trim(description)) > 1),
  quantity            numeric(12,2) not null check (quantity > 0),
  received_quantity   numeric(12,2) not null default 0 check (received_quantity >= 0),
  estimated_unit_cost numeric(14,2),
  asset_id            uuid references assets(id),
  check (received_quantity <= quantity)
);
create index pr_items_pr_idx on purchase_request_items (purchase_request_id);

-- ---------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------

-- Stock movement: the only way stock changes
create or replace function public.record_stock_movement(
  p_part_id uuid, p_type movement_type, p_quantity numeric, p_idempotency_key uuid,
  p_unit_cost numeric default null, p_asset_id uuid default null,
  p_reference text default null, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  part spare_parts%rowtype;
  v_qty numeric;
  v_new numeric;
  v_avg numeric;
  v_existing part_stock_movements%rowtype;
begin
  if not has_role('admin','stores','fleet') then raise exception 'NOT_AUTHORISED'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'QUANTITY_INVALID'; end if;

  select * into v_existing from part_stock_movements where idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('status','already_recorded','balance', v_existing.balance_after); end if;

  -- direction from the movement type
  v_qty := case p_type
    when 'opening_balance' then p_quantity when 'purchase_receipt' then p_quantity
    when 'adjustment_in' then p_quantity   when 'return_to_stock' then p_quantity
    else -p_quantity end;

  if v_qty < 0 and not has_role('admin','stores','fleet') then raise exception 'NOT_AUTHORISED'; end if;
  if p_type in ('adjustment_in','adjustment_out','write_off') and coalesce(length(trim(p_reason)),0) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into part from spare_parts where id = p_part_id for update;
  if not found or part.archived_at is not null then raise exception 'PART_NOT_FOUND'; end if;

  v_new := part.current_stock + v_qty;
  if v_new < 0 then
    raise exception 'INSUFFICIENT_STOCK: only % % in stock', part.current_stock, part.unit;
  end if;

  v_avg := part.average_cost;
  if v_qty > 0 and p_unit_cost is not null and p_unit_cost > 0 then
    v_avg := case when v_new = 0 then p_unit_cost
                  else ((part.current_stock * part.average_cost) + (v_qty * p_unit_cost)) / v_new end;
  end if;

  insert into part_stock_movements (spare_part_id, movement_type, quantity, balance_after, unit_cost,
                                    asset_id, reference, reason, idempotency_key)
  values (p_part_id, p_type, v_qty, v_new, coalesce(p_unit_cost, v_avg), p_asset_id, p_reference, p_reason, p_idempotency_key);

  perform set_config('afams.stock_write', 'on', true);
  update spare_parts set current_stock = v_new, average_cost = v_avg where id = p_part_id;
  perform set_config('afams.stock_write', 'off', true);

  return jsonb_build_object('status','saved','balance', v_new, 'low', v_new <= part.minimum_stock);
end $$;

-- Purchase request state machine
create or replace function public.transition_purchase_request(
  p_pr_id uuid, p_to pr_status, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr purchase_requests%rowtype; v_role app_role := current_app_role();
begin
  select * into pr from purchase_requests where id = p_pr_id for update;
  if not found then raise exception 'PR_NOT_FOUND'; end if;

  if p_to = 'submitted' then
    if pr.status <> 'draft' then raise exception 'INVALID_TRANSITION'; end if;
    if not (v_role in ('admin','stores','fleet')) then raise exception 'NOT_AUTHORISED'; end if;
    if not exists (select 1 from purchase_request_items where purchase_request_id = p_pr_id) then
      raise exception 'PR_HAS_NO_ITEMS';
    end if;
    update purchase_requests set status = 'submitted', updated_at = now() where id = p_pr_id;

  elsif p_to in ('approved','rejected') then
    if pr.status <> 'submitted' then raise exception 'INVALID_TRANSITION'; end if;
    if not (v_role in ('admin','management')) then raise exception 'NOT_AUTHORISED'; end if;
    if pr.requested_by = auth.uid() then raise exception 'CANNOT_APPROVE_OWN_REQUEST'; end if;
    if p_to = 'rejected' and coalesce(length(trim(p_note)),0) < 3 then raise exception 'REASON_REQUIRED'; end if;
    update purchase_requests set status = p_to, approved_by = auth.uid(), approved_at = now(),
           rejection_reason = case when p_to = 'rejected' then p_note else null end, updated_at = now()
    where id = p_pr_id;

  elsif p_to = 'ordered' then
    if pr.status <> 'approved' then raise exception 'INVALID_TRANSITION'; end if;
    if not (v_role in ('admin','stores')) then raise exception 'NOT_AUTHORISED'; end if;
    update purchase_requests set status = 'ordered', ordered_at = now(), updated_at = now() where id = p_pr_id;

  elsif p_to = 'cancelled' then
    if pr.status in ('received','cancelled') then raise exception 'INVALID_TRANSITION'; end if;
    if not (v_role in ('admin','stores') or pr.requested_by = auth.uid()) then raise exception 'NOT_AUTHORISED'; end if;
    update purchase_requests set status = 'cancelled', updated_at = now() where id = p_pr_id;

  else
    raise exception 'INVALID_TRANSITION';
  end if;

  return jsonb_build_object('status', p_to);
end $$;

-- Receive one line of a purchase request → stock in
create or replace function public.receive_purchase_item(
  p_item_id uuid, p_quantity numeric, p_unit_cost numeric, p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it purchase_request_items%rowtype; pr purchase_requests%rowtype; v_outstanding numeric;
begin
  if not has_role('admin','stores') then raise exception 'NOT_AUTHORISED'; end if;
  select * into it from purchase_request_items where id = p_item_id for update;
  if not found then raise exception 'ITEM_NOT_FOUND'; end if;
  select * into pr from purchase_requests where id = it.purchase_request_id for update;
  if pr.status not in ('approved','ordered') then raise exception 'PR_NOT_RECEIVABLE'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'QUANTITY_INVALID'; end if;

  v_outstanding := it.quantity - it.received_quantity;
  if p_quantity > v_outstanding then raise exception 'MORE_THAN_ORDERED'; end if;

  if it.spare_part_id is not null then
    perform record_stock_movement(it.spare_part_id, 'purchase_receipt', p_quantity, p_idempotency_key,
                                  p_unit_cost, it.asset_id, pr.request_number, null);
  end if;

  update purchase_request_items set received_quantity = received_quantity + p_quantity where id = p_item_id;

  if not exists (select 1 from purchase_request_items
                 where purchase_request_id = pr.id and received_quantity < quantity) then
    update purchase_requests set status = 'received', received_at = now(), updated_at = now() where id = pr.id;
  end if;

  return jsonb_build_object('status','saved');
end $$;

-- Reporting and resolving breakdowns (keeps the asset status in step)
create or replace function public.report_breakdown(
  p_asset_id uuid, p_description text, p_severity breakdown_severity,
  p_asset_operable boolean, p_location text default null, p_meter numeric default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_number text;
begin
  if not is_active_user() then raise exception 'NOT_AUTHORISED'; end if;
  insert into breakdowns (asset_id, description, severity, asset_operable, location, meter_reading)
  values (p_asset_id, p_description, p_severity, p_asset_operable, p_location, p_meter)
  returning id, breakdown_number into v_id, v_number;

  if not p_asset_operable then
    update assets set operational_status = 'breakdown' where id = p_asset_id and operational_status <> 'disposed';
  end if;

  if p_meter is not null then
    begin
      perform record_meter_reading(p_asset_id, p_meter, now(), true, 'Recorded when reporting ' || v_number);
    exception when others then null;  -- a bad reading must never block a breakdown report
    end;
  end if;

  return jsonb_build_object('status','saved','id', v_id, 'number', v_number);
end $$;

create or replace function public.resolve_breakdown(
  p_id uuid, p_resolution text, p_cost numeric default null, p_back_in_service boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b breakdowns%rowtype;
begin
  if not has_role('admin','fleet') then raise exception 'NOT_AUTHORISED'; end if;
  if coalesce(length(trim(p_resolution)),0) < 3 then raise exception 'RESOLUTION_REQUIRED'; end if;
  select * into b from breakdowns where id = p_id for update;
  if not found then raise exception 'BREAKDOWN_NOT_FOUND'; end if;

  update breakdowns set status = 'resolved', resolution_notes = p_resolution, repair_cost = p_cost,
         resolved_at = now(), updated_at = now() where id = p_id;

  if p_back_in_service and not exists (
    select 1 from breakdowns where asset_id = b.asset_id and status <> 'resolved' and id <> p_id and not asset_operable
  ) then
    update assets set operational_status = 'operational'
    where id = b.asset_id and operational_status = 'breakdown';
  end if;

  return jsonb_build_object('status','saved');
end $$;

-- ---------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------
create view v_part_stock_status with (security_invoker = true) as
select p.*, s.name as supplier_name,
  case when p.current_stock <= 0 then 'out_of_stock'
       when p.current_stock <= p.minimum_stock then 'low'
       else 'ok' end as stock_status,
  (select coalesce(sum(i.quantity - i.received_quantity), 0)
     from purchase_request_items i
     join purchase_requests r on r.id = i.purchase_request_id
    where i.spare_part_id = p.id and r.status in ('draft','submitted','approved','ordered')) as on_order
from spare_parts p
left join suppliers s on s.id = p.supplier_id
where p.archived_at is null;

create view v_breakdowns with (security_invoker = true) as
select b.*, a.name as asset_name, a.registration_number, a.meter_type,
  r.full_name as reported_by_name, t.full_name as assigned_to_name,
  case when b.resolved_at is not null
       then round(extract(epoch from (b.resolved_at - b.reported_at)) / 3600.0, 1)
       else round(extract(epoch from (now() - b.reported_at)) / 3600.0, 1) end as hours_down
from breakdowns b
join assets a on a.id = b.asset_id
left join profiles r on r.id = b.reported_by
left join profiles t on t.id = b.assigned_to;

create view v_purchase_requests with (security_invoker = true) as
select r.*, s.name as supplier_name, rq.full_name as requested_by_name, ap.full_name as approved_by_name,
  (select count(*) from purchase_request_items i where i.purchase_request_id = r.id) as item_count,
  (select coalesce(sum(i.quantity * coalesce(i.estimated_unit_cost, 0)), 0)
     from purchase_request_items i where i.purchase_request_id = r.id) as estimated_total
from purchase_requests r
left join suppliers s on s.id = r.supplier_id
left join profiles rq on rq.id = r.requested_by
left join profiles ap on ap.id = r.approved_by;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table breakdowns enable row level security;
alter table suppliers enable row level security;
alter table spare_parts enable row level security;
alter table part_stock_movements enable row level security;
alter table purchase_requests enable row level security;
alter table purchase_request_items enable row level security;
alter table document_sequences enable row level security;

create policy bd_read on breakdowns for select to authenticated using (is_active_user());
create policy bd_insert on breakdowns for insert to authenticated with check (is_active_user());
create policy bd_update on breakdowns for update to authenticated using (has_role('admin','fleet')) with check (has_role('admin','fleet'));

create policy sup_read on suppliers for select to authenticated using (is_active_user());
create policy sup_write on suppliers for insert to authenticated with check (has_role('admin','stores'));
create policy sup_update on suppliers for update to authenticated using (has_role('admin','stores')) with check (has_role('admin','stores'));

create policy parts_read on spare_parts for select to authenticated using (is_active_user());
create policy parts_insert on spare_parts for insert to authenticated with check (has_role('admin','stores'));
create policy parts_update on spare_parts for update to authenticated using (has_role('admin','stores')) with check (has_role('admin','stores'));

create policy mv_read on part_stock_movements for select to authenticated using (is_active_user());
-- movements are written only by record_stock_movement()

create policy pr_read on purchase_requests for select to authenticated using (is_active_user());
create policy pr_insert on purchase_requests for insert to authenticated with check (has_role('admin','stores','fleet'));
create policy pr_update on purchase_requests for update to authenticated using (has_role('admin','stores')) with check (has_role('admin','stores'));

create policy pri_read on purchase_request_items for select to authenticated using (is_active_user());
create policy pri_write on purchase_request_items for insert to authenticated with check (has_role('admin','stores','fleet'));
create policy pri_update on purchase_request_items for update to authenticated using (has_role('admin','stores','fleet')) with check (has_role('admin','stores','fleet'));
create policy pri_delete on purchase_request_items for delete to authenticated using (has_role('admin','stores','fleet'));

-- audit
create trigger audit_breakdowns after insert or update on breakdowns for each row execute function public.audit_row();
create trigger audit_parts after insert or update on spare_parts for each row execute function public.audit_row();
create trigger audit_pr after insert or update on purchase_requests for each row execute function public.audit_row();

revoke all on function public.record_stock_movement(uuid, movement_type, numeric, uuid, numeric, uuid, text, text) from public, anon;
revoke all on function public.transition_purchase_request(uuid, pr_status, text) from public, anon;
revoke all on function public.receive_purchase_item(uuid, numeric, numeric, uuid) from public, anon;
revoke all on function public.report_breakdown(uuid, text, breakdown_severity, boolean, text, numeric) from public, anon;
revoke all on function public.resolve_breakdown(uuid, text, numeric, boolean) from public, anon;
grant execute on function public.record_stock_movement(uuid, movement_type, numeric, uuid, numeric, uuid, text, text) to authenticated;
grant execute on function public.transition_purchase_request(uuid, pr_status, text) to authenticated;
grant execute on function public.receive_purchase_item(uuid, numeric, numeric, uuid) to authenticated;
grant execute on function public.report_breakdown(uuid, text, breakdown_severity, boolean, text, numeric) to authenticated;
grant execute on function public.resolve_breakdown(uuid, text, numeric, boolean) to authenticated;
