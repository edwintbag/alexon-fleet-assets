-- =====================================================================
-- ALEXON FLEET & ASSET MANAGEMENT SYSTEM (AFAMS) — Release 1 schema
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run
-- Safe to run on an EMPTY project only.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type app_role as enum ('admin','fleet','stores','management');
create type meter_type as enum ('km','hours','none');
create type asset_class as enum ('vehicle','machinery','trailer','equipment');
create type operational_status as enum ('operational','under_maintenance','breakdown','standby','disposed');
create type service_status as enum ('normal','approaching','due_soon','due','overdue','no_data');
create type compliance_status as enum ('valid','expiring_soon','expired');
create type schedule_anchor as enum ('actual','planned');

-- ---------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------
create table app_settings (
  id                    boolean primary key default true check (id),
  company_name          text not null default 'Alexon Group Ltd',
  km_approaching        numeric not null default 3000,
  km_due_soon           numeric not null default 1000,
  km_due_window         numeric not null default 250,
  km_overdue_grace      numeric not null default 0,
  hours_approaching     numeric not null default 50,
  hours_due_soon        numeric not null default 20,
  hours_due_window      numeric not null default 5,
  hours_overdue_grace   numeric not null default 0,
  days_approaching      integer not null default 30,
  days_due_soon         integer not null default 14,
  days_due_window       integer not null default 3,
  stale_reading_days    integer not null default 7,
  max_km_per_day        numeric not null default 1000,
  compliance_warning_days integer not null default 30,
  digest_enabled        boolean not null default true,
  digest_extra_emails   text not null default '',
  updated_at            timestamptz not null default now(),
  check (km_approaching > km_due_soon and km_due_soon >= km_due_window and km_due_window >= 0 and km_overdue_grace >= 0),
  check (hours_approaching > hours_due_soon and hours_due_soon >= hours_due_window and hours_due_window >= 0 and hours_overdue_grace >= 0),
  check (days_approaching > days_due_soon and days_due_soon >= days_due_window and days_due_window >= 0),
  check (stale_reading_days > 0 and max_km_per_day > 0 and compliance_warning_days >= 0)
);
insert into app_settings default values;

-- ---------------------------------------------------------------------
-- Users (profiles linked to Supabase Auth)
-- ---------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       citext not null unique,
  phone       text,
  role        app_role not null default 'management',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.nairobi_today() returns date
language sql stable as $$ select (now() at time zone 'Africa/Nairobi')::date $$;

create or replace function public.current_app_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function public.has_role(variadic roles app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_app_role() = any(roles), false)
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select current_app_role() is not null
$$;

-- New auth user → profile.
-- Users created from the app's Users page get their role and are active.
-- Anyone created another way (e.g. Supabase dashboard, or sign-up if it was left on)
-- starts INACTIVE with no access until an admin activates them.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data->>'full_name', ''),
    coalesce((new.raw_app_meta_data->>'role')::app_role, 'management'),
    (new.raw_app_meta_data ? 'role')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Protect privileges: only admins change role/active; nobody demotes/deactivates themselves
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then  -- service role / SQL editor
    return new;
  end if;
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active
      or new.email is distinct from old.email) and not has_role('admin') then
    raise exception 'NOT_AUTHORISED';
  end if;
  if new.id = auth.uid() and (new.role is distinct from old.role or new.is_active = false) then
    raise exception 'CANNOT_CHANGE_OWN_ROLE';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_protect before update on profiles
  for each row execute function public.protect_profile();

-- ---------------------------------------------------------------------
-- Assets
-- ---------------------------------------------------------------------
create table assets (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null check (length(trim(name)) > 0),
  registration_number    text,           -- stored normalised: KDW288H
  category               text not null default '',
  asset_class            asset_class not null default 'vehicle',
  make                   text,
  model                  text,
  meter_type             meter_type not null default 'km',
  current_reading        numeric(12,1),
  reading_at             timestamptz,
  operational_status     operational_status not null default 'operational',
  responsible_user_id    uuid references profiles(id),
  notes                  text,
  archived_at            timestamptz,
  created_by             uuid references profiles(id) default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (meter_type <> 'none' or current_reading is null)
);
create unique index assets_reg_unique on assets (registration_number)
  where registration_number is not null and archived_at is null;
create index assets_status_idx on assets (operational_status);

create or replace function public.assets_before_write() returns trigger
language plpgsql as $$
begin
  new.registration_number := nullif(upper(regexp_replace(coalesce(new.registration_number,''), '\s+', '', 'g')), '');
  new.updated_at := now();
  -- readings may only change through record_meter_reading() / complete_service()
  if tg_op = 'UPDATE'
     and (new.current_reading is distinct from old.current_reading or new.reading_at is distinct from old.reading_at)
     and coalesce(current_setting('afams.meter_write', true), '') <> 'on'
     and auth.uid() is not null then
    raise exception 'USE_READING_FORM';
  end if;
  if tg_op = 'UPDATE' and new.meter_type is distinct from old.meter_type
     and exists (select 1 from meter_readings where asset_id = new.id) then
    raise exception 'METER_TYPE_LOCKED';
  end if;
  return new;
end $$;

create table meter_readings (
  id               uuid primary key default gen_random_uuid(),
  asset_id         uuid not null references assets(id),
  reading          numeric(12,1) not null check (reading >= 0),
  previous_reading numeric(12,1),
  reading_at       timestamptz not null default now(),
  source           text not null default 'manual' check (source in ('manual','service','import','correction')),
  note             text,
  flagged          boolean not null default false,
  recorded_by      uuid references profiles(id) default auth.uid(),
  created_at       timestamptz not null default now()
);
create index meter_readings_asset_idx on meter_readings (asset_id, reading_at desc);

create trigger assets_before_write before insert or update on assets
  for each row execute function public.assets_before_write();

-- ---------------------------------------------------------------------
-- Service plans (one per asset) and service records
-- ---------------------------------------------------------------------
create table service_plans (
  asset_id            uuid primary key references assets(id),
  interval_meter      numeric(12,1) check (interval_meter is null or interval_meter > 0),
  interval_days       integer check (interval_days is null or interval_days > 0),
  last_service_meter  numeric(12,1),
  last_service_date   date,
  next_due_meter      numeric(12,1),
  next_due_date       date,
  schedule_anchor     schedule_anchor not null default 'actual',
  service_type_note   text,
  estimated_cost      numeric(14,2),
  updated_at          timestamptz not null default now()
);

create table service_records (
  id                uuid primary key default gen_random_uuid(),
  asset_id          uuid not null references assets(id),
  service_date      date not null,
  meter_at_service  numeric(12,1),
  service_type      text,
  performed_by      text,
  cost              numeric(14,2) not null default 0 check (cost >= 0),
  notes             text,
  next_due_meter_set numeric(12,1),
  next_due_date_set  date,
  completed_by      uuid references profiles(id) default auth.uid(),
  created_at        timestamptz not null default now()
);
create index service_records_asset_idx on service_records (asset_id, service_date desc);

-- ---------------------------------------------------------------------
-- Compliance documents
-- ---------------------------------------------------------------------
create table compliance_documents (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid references assets(id),          -- null = company-level document
  document_type   text not null check (length(trim(document_type)) > 0),
  document_number text,
  issuer          text,
  issue_date      date,
  expiry_date     date not null,
  cost            numeric(14,2),
  file_path       text,
  notes           text,
  is_current      boolean not null default true,
  created_by      uuid references profiles(id) default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (issue_date is null or expiry_date >= issue_date)
);
create index compliance_expiry_idx on compliance_documents (expiry_date) where is_current;

-- ---------------------------------------------------------------------
-- Audit log (simple)
-- ---------------------------------------------------------------------
create table audit_logs (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb
);
create index audit_logs_entity_idx on audit_logs (entity, entity_id, occurred_at desc);

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  v_id := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'asset_id', to_jsonb(old)->>'id', to_jsonb(old)->>'asset_id');
  insert into audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, v_id,
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_assets after insert or update on assets for each row execute function public.audit_row();
create trigger audit_service_plans after insert or update on service_plans for each row execute function public.audit_row();
create trigger audit_service_records after insert on service_records for each row execute function public.audit_row();
create trigger audit_compliance after insert or update on compliance_documents for each row execute function public.audit_row();
create trigger audit_profiles after update on profiles for each row execute function public.audit_row();
create trigger audit_settings after update on app_settings for each row execute function public.audit_row();

-- ---------------------------------------------------------------------
-- Business functions
-- ---------------------------------------------------------------------

-- Classify "remaining" into a status using thresholds
create or replace function public.classify_remaining(p_remaining numeric, p_approaching numeric,
  p_due_soon numeric, p_due_window numeric, p_grace numeric) returns service_status
language sql immutable as $$
  select case
    when p_remaining is null then 'no_data'
    when p_remaining < -p_grace then 'overdue'
    when p_remaining <= p_due_window then 'due'
    when p_remaining <= p_due_soon then 'due_soon'
    when p_remaining <= p_approaching then 'approaching'
    else 'normal' end::service_status
$$;

create or replace function public.status_rank(s service_status) returns int
language sql immutable as $$
  select case s when 'overdue' then 5 when 'due' then 4 when 'due_soon' then 3
                when 'approaching' then 2 when 'normal' then 1 else 0 end
$$;

-- Record a KM/hours reading with validation.
-- Returns {status:'saved'} or {status:'needs_confirmation', warning:'...'}; raises on hard errors.
create or replace function public.record_meter_reading(
  p_asset_id uuid, p_reading numeric, p_reading_at timestamptz default now(),
  p_confirmed boolean default false, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a assets%rowtype;
  s app_settings%rowtype;
  v_hours_elapsed numeric;
  v_days numeric;
  v_delta numeric;
  v_is_correction boolean := false;
  v_warning text;
begin
  if not has_role('admin','fleet') then raise exception 'NOT_AUTHORISED'; end if;
  select * into a from assets where id = p_asset_id for update;
  if not found or a.archived_at is not null then raise exception 'ASSET_NOT_FOUND'; end if;
  if a.meter_type = 'none' then raise exception 'ASSET_HAS_NO_METER'; end if;
  if p_reading is null or p_reading < 0 then raise exception 'READING_INVALID'; end if;
  if p_reading_at > now() + interval '5 minutes' then raise exception 'READING_IN_FUTURE'; end if;
  select * into s from app_settings;

  if a.current_reading is not null then
    if a.reading_at is not null and p_reading_at < a.reading_at then
      raise exception 'READING_OLDER_THAN_LATEST';
    end if;
    v_delta := p_reading - a.current_reading;
    if v_delta < 0 then
      if not has_role('admin') then raise exception 'READING_BELOW_CURRENT'; end if;
      if coalesce(length(trim(p_note)),0) < 5 then raise exception 'CORRECTION_REASON_REQUIRED'; end if;
      v_is_correction := true;
    end if;
    v_hours_elapsed := extract(epoch from (p_reading_at - coalesce(a.reading_at, p_reading_at))) / 3600.0;
    if a.meter_type = 'hours' and not v_is_correction and a.reading_at is not null
       and v_delta > v_hours_elapsed + 0.5 then
      raise exception 'HOURS_EXCEED_ELAPSED_TIME';
    end if;
    if a.meter_type = 'km' and not v_is_correction and a.reading_at is not null then
      v_days := greatest(1, v_hours_elapsed / 24.0);
      if v_delta > v_days * s.max_km_per_day then
        v_warning := format('That is %s km since the last reading — more than %s km per day. Is the reading correct?',
                            to_char(v_delta, 'FM999,999,990'), to_char(s.max_km_per_day, 'FM999,999'));
      end if;
    end if;
  end if;

  if v_warning is not null and not p_confirmed then
    return jsonb_build_object('status','needs_confirmation','warning', v_warning);
  end if;

  insert into meter_readings (asset_id, reading, previous_reading, reading_at, source, note, flagged)
  values (p_asset_id, p_reading, a.current_reading, p_reading_at,
          case when v_is_correction then 'correction' else 'manual' end, p_note, v_warning is not null);

  perform set_config('afams.meter_write', 'on', true);
  update assets set current_reading = p_reading, reading_at = p_reading_at where id = p_asset_id;
  perform set_config('afams.meter_write', 'off', true);

  return jsonb_build_object('status','saved');
end $$;

-- Mark a service as complete and schedule the next one
create or replace function public.complete_service(
  p_asset_id uuid, p_service_date date, p_meter numeric, p_service_type text,
  p_performed_by text, p_cost numeric, p_notes text, p_set_operational boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a assets%rowtype;
  p service_plans%rowtype;
  v_next_meter numeric;
  v_next_date date;
begin
  if not has_role('admin','fleet') then raise exception 'NOT_AUTHORISED'; end if;
  select * into a from assets where id = p_asset_id for update;
  if not found or a.archived_at is not null then raise exception 'ASSET_NOT_FOUND'; end if;
  if p_service_date is null or p_service_date > nairobi_today() then raise exception 'SERVICE_DATE_INVALID'; end if;
  select * into p from service_plans where asset_id = p_asset_id for update;
  if not found then raise exception 'NO_SERVICE_PLAN'; end if;

  if a.meter_type <> 'none' then
    if p_meter is null then raise exception 'SERVICE_READING_REQUIRED'; end if;
    if p.last_service_meter is not null and p_meter < p.last_service_meter then
      raise exception 'SERVICE_READING_BELOW_LAST_SERVICE';
    end if;
  end if;
  if p.last_service_date is not null and p_service_date < p.last_service_date then
    raise exception 'SERVICE_DATE_BEFORE_LAST_SERVICE';
  end if;

  if p.interval_meter is not null and p_meter is not null then
    if p.schedule_anchor = 'planned' and p.next_due_meter is not null
       and p.next_due_meter + p.interval_meter > p_meter then
      v_next_meter := p.next_due_meter + p.interval_meter;
    else
      v_next_meter := p_meter + p.interval_meter;
    end if;
  end if;
  if p.interval_days is not null then
    v_next_date := p_service_date + p.interval_days;
  end if;

  insert into service_records (asset_id, service_date, meter_at_service, service_type, performed_by, cost, notes,
                               next_due_meter_set, next_due_date_set)
  values (p_asset_id, p_service_date, p_meter, nullif(trim(p_service_type),''), nullif(trim(p_performed_by),''),
          coalesce(p_cost,0), nullif(trim(p_notes),''), v_next_meter, v_next_date);

  update service_plans set
    last_service_meter = coalesce(p_meter, last_service_meter),
    last_service_date  = p_service_date,
    next_due_meter     = coalesce(v_next_meter, next_due_meter),
    next_due_date      = coalesce(v_next_date, next_due_date),
    updated_at         = now()
  where asset_id = p_asset_id;

  -- a service reading higher than the current reading also updates the asset
  if a.meter_type <> 'none' and (a.current_reading is null or p_meter > a.current_reading) then
    insert into meter_readings (asset_id, reading, previous_reading, reading_at, source, note)
    values (p_asset_id, p_meter, a.current_reading, greatest(p_service_date::timestamptz, coalesce(a.reading_at, '-infinity')), 'service', 'Recorded at service');
    perform set_config('afams.meter_write', 'on', true);
    update assets set current_reading = p_meter,
      reading_at = greatest(p_service_date::timestamptz, coalesce(a.reading_at, '-infinity'))
    where id = p_asset_id;
    perform set_config('afams.meter_write', 'off', true);
  end if;

  if p_set_operational and a.operational_status = 'under_maintenance' then
    update assets set operational_status = 'operational' where id = p_asset_id;
  end if;

  return jsonb_build_object('status','saved','next_due_meter', v_next_meter, 'next_due_date', v_next_date);
end $$;

-- ---------------------------------------------------------------------
-- Views (security_invoker so RLS applies)
-- ---------------------------------------------------------------------
create view v_asset_service_status with (security_invoker = true) as
with s as (select * from app_settings)
select
  a.id, a.name, a.registration_number, a.category, a.asset_class, a.meter_type,
  a.current_reading, a.reading_at, a.operational_status, a.responsible_user_id, a.archived_at,
  p.interval_meter, p.interval_days, p.last_service_meter, p.last_service_date,
  p.next_due_meter, p.next_due_date, p.schedule_anchor, p.service_type_note, p.estimated_cost,
  (p.asset_id is not null) as has_plan,
  case when p.next_due_meter is not null and a.current_reading is not null
       then p.next_due_meter - a.current_reading end as remaining_meter,
  case when p.next_due_date is not null then p.next_due_date - nairobi_today() end as remaining_days,
  case when a.meter_type = 'none' or a.reading_at is null then (a.meter_type <> 'none')
       else a.reading_at < now() - make_interval(days => s.stale_reading_days) end as reading_stale,
  case when a.reading_at is not null
       then floor(extract(epoch from now() - a.reading_at) / 86400)::int end as reading_age_days,
  ms.meter_status, ds.date_status,
  case when status_rank(coalesce(ms.meter_status,'no_data')) >= status_rank(coalesce(ds.date_status,'no_data'))
       then coalesce(ms.meter_status,'no_data') else ds.date_status end as service_status
from assets a
cross join s
left join service_plans p on p.asset_id = a.id
cross join lateral (
  select case when p.next_due_meter is null or a.current_reading is null then null
    when a.meter_type = 'hours' then classify_remaining(p.next_due_meter - a.current_reading,
         s.hours_approaching, s.hours_due_soon, s.hours_due_window, s.hours_overdue_grace)
    else classify_remaining(p.next_due_meter - a.current_reading,
         s.km_approaching, s.km_due_soon, s.km_due_window, s.km_overdue_grace) end as meter_status
) ms
cross join lateral (
  select case when p.next_due_date is null then null
    else classify_remaining((p.next_due_date - nairobi_today())::numeric,
         s.days_approaching, s.days_due_soon, s.days_due_window, 0) end as date_status
) ds;

create view v_compliance_status with (security_invoker = true) as
select d.*, a.name as asset_name, a.registration_number,
  d.expiry_date - nairobi_today() as days_remaining,
  case when d.expiry_date < nairobi_today() then 'expired'
       when d.expiry_date - nairobi_today() <= (select compliance_warning_days from app_settings) then 'expiring_soon'
       else 'valid' end::compliance_status as status
from compliance_documents d
left join assets a on a.id = d.asset_id
where d.is_current;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table app_settings enable row level security;
alter table profiles enable row level security;
alter table assets enable row level security;
alter table meter_readings enable row level security;
alter table service_plans enable row level security;
alter table service_records enable row level security;
alter table compliance_documents enable row level security;
alter table audit_logs enable row level security;

create policy settings_read on app_settings for select to authenticated using (is_active_user());
create policy settings_admin on app_settings for update to authenticated using (has_role('admin')) with check (has_role('admin'));

create policy profiles_read on profiles for select to authenticated using (is_active_user() or id = auth.uid());
create policy profiles_update_self on profiles for update to authenticated using (id = auth.uid() or has_role('admin')) with check (id = auth.uid() or has_role('admin'));

create policy assets_read on assets for select to authenticated using (is_active_user());
create policy assets_insert on assets for insert to authenticated with check (has_role('admin','fleet'));
create policy assets_update on assets for update to authenticated using (has_role('admin','fleet')) with check (has_role('admin','fleet'));

create policy readings_read on meter_readings for select to authenticated using (is_active_user());
-- no insert/update/delete policies: readings only via record_meter_reading()

create policy plans_read on service_plans for select to authenticated using (is_active_user());
create policy plans_insert on service_plans for insert to authenticated with check (has_role('admin','fleet'));
create policy plans_update on service_plans for update to authenticated using (has_role('admin','fleet')) with check (has_role('admin','fleet'));

create policy records_read on service_records for select to authenticated using (is_active_user());
-- inserts only via complete_service()

create policy docs_read on compliance_documents for select to authenticated using (is_active_user());
create policy docs_insert on compliance_documents for insert to authenticated with check (has_role('admin','fleet'));
create policy docs_update on compliance_documents for update to authenticated using (has_role('admin','fleet')) with check (has_role('admin','fleet'));

create policy audit_read on audit_logs for select to authenticated using (has_role('admin','management'));

revoke all on function public.record_meter_reading(uuid, numeric, timestamptz, boolean, text) from public, anon;
revoke all on function public.complete_service(uuid, date, numeric, text, text, numeric, text, boolean) from public, anon;
grant execute on function public.record_meter_reading(uuid, numeric, timestamptz, boolean, text) to authenticated;
grant execute on function public.complete_service(uuid, date, numeric, text, text, numeric, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Storage bucket for compliance documents (private)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('compliance-docs', 'compliance-docs', false, 4194304,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "compliance docs read" on storage.objects for select to authenticated
  using (bucket_id = 'compliance-docs' and public.is_active_user());
create policy "compliance docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'compliance-docs' and public.has_role('admin','fleet'));
