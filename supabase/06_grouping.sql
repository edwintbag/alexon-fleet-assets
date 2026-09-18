-- =====================================================================
-- AFAMS — add asset class to the breakdown and compliance views
-- so those lists can group vehicles and machinery separately.
-- Run once, after 05_reports.sql.
-- =====================================================================

drop view if exists v_breakdowns;
create view v_breakdowns with (security_invoker = true) as
select b.*, a.name as asset_name, a.registration_number, a.meter_type, a.asset_class,
  r.full_name as reported_by_name, t.full_name as assigned_to_name,
  case when b.resolved_at is not null
       then round(extract(epoch from (b.resolved_at - b.reported_at)) / 3600.0, 1)
       else round(extract(epoch from (now() - b.reported_at)) / 3600.0, 1) end as hours_down
from breakdowns b
join assets a on a.id = b.asset_id
left join profiles r on r.id = b.reported_by
left join profiles t on t.id = b.assigned_to;

drop view if exists v_compliance_status;
create view v_compliance_status with (security_invoker = true) as
select d.*, a.name as asset_name, a.registration_number, a.asset_class,
  d.expiry_date - nairobi_today() as days_remaining,
  case when d.expiry_date < nairobi_today() then 'expired'
       when d.expiry_date - nairobi_today() <= (select compliance_warning_days from app_settings) then 'expiring_soon'
       else 'valid' end::compliance_status as status
from compliance_documents d
left join assets a on a.id = d.asset_id
where d.is_current;
