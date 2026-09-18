-- =====================================================================
-- AFAMS — management reports (weekly + monthly email)
-- Run once, after 04_files.sql.
-- =====================================================================

alter table app_settings
  add column if not exists weekly_report_enabled  boolean not null default true,
  add column if not exists monthly_report_enabled boolean not null default true,
  add column if not exists report_extra_emails    text    not null default '';

-- Totals for a period, used by the report page and the report email
create or replace function public.management_report(p_from date, p_to date)
returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'assets', (
      select jsonb_build_object(
        'total', count(*),
        'operational', count(*) filter (where operational_status = 'operational'),
        'maintenance', count(*) filter (where operational_status = 'under_maintenance'),
        'breakdown', count(*) filter (where operational_status = 'breakdown'),
        'standby', count(*) filter (where operational_status = 'standby'))
      from assets where archived_at is null and operational_status <> 'disposed'),
    'service', (
      select jsonb_build_object(
        'overdue', count(*) filter (where service_status = 'overdue'),
        'due', count(*) filter (where service_status in ('due','due_soon')),
        'stale_readings', count(*) filter (where reading_stale and meter_type <> 'none'))
      from v_asset_service_status where archived_at is null),
    'services_done', (
      select jsonb_build_object('count', count(*), 'cost', coalesce(sum(cost), 0))
      from service_records where service_date between p_from and p_to),
    'breakdowns', (
      select jsonb_build_object(
        'reported', count(*),
        'resolved', count(*) filter (where status = 'resolved' and resolved_at::date between p_from and p_to),
        'cost', coalesce(sum(repair_cost) filter (where resolved_at::date between p_from and p_to), 0),
        'downtime_hours', coalesce(round(sum(
            extract(epoch from (coalesce(resolved_at, now()) - reported_at)) / 3600.0
          ) filter (where reported_at::date between p_from and p_to), 1), 0))
      from breakdowns where reported_at::date between p_from and p_to
         or (status = 'resolved' and resolved_at::date between p_from and p_to)),
    'compliance', (
      select jsonb_build_object(
        'expired', count(*) filter (where status = 'expired'),
        'expiring', count(*) filter (where status = 'expiring_soon'))
      from v_compliance_status),
    'parts', (
      select jsonb_build_object(
        'low', count(*) filter (where stock_status = 'low'),
        'out', count(*) filter (where stock_status = 'out_of_stock'),
        'stock_value', coalesce(round(sum(current_stock * average_cost), 2), 0))
      from v_part_stock_status),
    'purchasing', (
      select jsonb_build_object(
        'awaiting_approval', count(*) filter (where status = 'submitted'),
        'received_value', coalesce((
          select round(sum(i.received_quantity * coalesce(i.estimated_unit_cost, 0)), 2)
          from purchase_request_items i join purchase_requests r on r.id = i.purchase_request_id
          where r.received_at::date between p_from and p_to), 0))
      from purchase_requests),
    'top_costs', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select a.name, a.registration_number as reg,
               round(coalesce(s.cost, 0) + coalesce(b.cost, 0), 2) as total,
               round(coalesce(s.cost, 0), 2) as service_cost,
               round(coalesce(b.cost, 0), 2) as repair_cost
        from assets a
        left join (select asset_id, sum(cost) cost from service_records
                   where service_date between p_from and p_to group by asset_id) s on s.asset_id = a.id
        left join (select asset_id, sum(repair_cost) cost from breakdowns
                   where resolved_at::date between p_from and p_to group by asset_id) b on b.asset_id = a.id
        where coalesce(s.cost, 0) + coalesce(b.cost, 0) > 0
        order by 3 desc limit 5) t)
  )
$$;

grant execute on function public.management_report(date, date) to authenticated;
