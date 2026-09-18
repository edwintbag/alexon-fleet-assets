-- =====================================================================
-- AFAMS — file attachments (service invoices, job cards, logbooks, photos)
-- Run once, after 03_release2.sql.
-- =====================================================================

create table asset_files (
  id                uuid primary key default gen_random_uuid(),
  asset_id          uuid not null references assets(id),
  service_record_id uuid references service_records(id),
  breakdown_id      uuid references breakdowns(id),
  title             text not null check (length(trim(title)) > 1),
  kind              text not null default 'other'
                    check (kind in ('invoice','job_card','quotation','logbook','photo','other')),
  file_path         text not null,
  file_size         integer,
  mime_type         text,
  uploaded_by       uuid references profiles(id) default auth.uid(),
  created_at        timestamptz not null default now()
);
create index asset_files_asset_idx on asset_files (asset_id, created_at desc);
create index asset_files_service_idx on asset_files (service_record_id);

alter table asset_files enable row level security;
create policy files_read on asset_files for select to authenticated using (is_active_user());
create policy files_insert on asset_files for insert to authenticated with check (has_role('admin','fleet','stores'));
create policy files_delete on asset_files for delete to authenticated using (has_role('admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('asset-files', 'asset-files', false, 4194304,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "asset files read" on storage.objects for select to authenticated
  using (bucket_id = 'asset-files' and public.is_active_user());
create policy "asset files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'asset-files' and public.has_role('admin','fleet','stores'));

-- complete_service now returns the new record's id so the app can attach an invoice to it
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
  v_record_id uuid;
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
          coalesce(p_cost,0), nullif(trim(p_notes),''), v_next_meter, v_next_date)
  returning id into v_record_id;

  update service_plans set
    last_service_meter = coalesce(p_meter, last_service_meter),
    last_service_date  = p_service_date,
    next_due_meter     = coalesce(v_next_meter, next_due_meter),
    next_due_date      = coalesce(v_next_date, next_due_date),
    updated_at         = now()
  where asset_id = p_asset_id;

  if a.meter_type <> 'none' and (a.current_reading is null or p_meter > a.current_reading) then
    insert into meter_readings (asset_id, reading, previous_reading, reading_at, source, note)
    values (p_asset_id, p_meter, a.current_reading,
            greatest(p_service_date::timestamptz, coalesce(a.reading_at, '-infinity')), 'service', 'Recorded at service');
    perform set_config('afams.meter_write', 'on', true);
    update assets set current_reading = p_meter,
      reading_at = greatest(p_service_date::timestamptz, coalesce(a.reading_at, '-infinity'))
    where id = p_asset_id;
    perform set_config('afams.meter_write', 'off', true);
  end if;

  if p_set_operational and a.operational_status = 'under_maintenance' then
    update assets set operational_status = 'operational' where id = p_asset_id;
  end if;

  return jsonb_build_object('status','saved','record_id', v_record_id,
                            'next_due_meter', v_next_meter, 'next_due_date', v_next_date);
end $$;
