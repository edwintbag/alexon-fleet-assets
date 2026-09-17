-- =====================================================================
-- AFAMS — initial assets from "FLEET & MACHINERY SERVICE SCHEDULE.xlsx"
-- Values are copied AS-IS from the spreadsheet (no guessing).
-- Items still to confirm are written into each asset's Notes.
-- You can correct anything later in the app (asset page → Edit / Service plan).
-- Run once, after 01_schema.sql.
-- Current readings had no date in the sheet, so they show as 'date unknown' until updated in the app.
-- =====================================================================
do $$
declare
  r record;
  v_id uuid;
begin
  for r in
    select * from (values
      -- name, reg, category, class, meter, current, interval, last_meter, last_date, next_due, service_type, est_cost, notes
      ('Mguu Kumi — Sinotruck (Howo)','KDW 288H','Truck','vehicle','km', 33117::numeric, 15000::numeric, 20302::numeric, date '2026-05-14', 35302::numeric, 'Minor Service', null::numeric,
        'Imported from Excel. Current reading date unknown.'),
      ('Mguu Sita — Isuzu','KDV 946M','Truck','vehicle','km', 39199, 10000, 30732, date '2026-05-29', 40732, 'Major Service', null,
        'Imported from Excel. CONFIRM: interval 10,000 km (other trucks 15,000). Is "Major Service" the last or the next service?'),
      ('Water Bowser — Isuzu','KDV 118X','Water Bowser','vehicle','km', 7048, 15000, 1102, date '2026-01-06', 16102, 'Minor Service', null,
        'Imported from Excel. CONFIRM: should this also have a time limit (e.g. every 6 or 12 months)?'),
      ('Pickup — Isuzu Dmax (New)','KDX 974Q','Pickup','vehicle','km', 9069, 10000, 1105, date '2026-04-28', 11105, 'Minor Service', null,
        'Imported from Excel. Current reading date unknown.'),
      ('Pickup — Isuzu Dmax (Old)','KBN 688N','Pickup','vehicle','km', null, null, null, null, null, null, null,
        'NEEDS SETUP: no service data in Excel (last service, interval, current reading).'),
      ('FRR 90 — Isuzu','KDY 273C','Truck','vehicle','km', 2201, 15000, 1126, date '2026-06-22', 16126, 'Minor Service', null,
        'Imported from Excel. Current reading date unknown.'),
      ('30-Tonne Tipper','KDX 695Z','Tipper','vehicle','km', 6645, 20640, 5640, date '2026-07-17', 26280, 'Minor Service', null,
        'CONFIRM: Excel interval is 20,640 km — possibly a typo for 15,000 (next service would then be 20,640).'),
      ('Lowbed','ZJ3321','Trailer','trailer','none', null, null, null, null, null, null, null,
        'NEEDS SETUP: no service data in Excel. Likely date-based servicing (no odometer) — set interval in days.'),
      ('Backhoe 1 — JCB','KHMA 821X','Backhoe Loader','machinery','hours', 1126, 500, 1000, date '2026-07-23', 1500, null, 111000,
        'Imported from Excel. Est. cost KES 111,000 (from sheet).'),
      ('Backhoe 2 — JCB','C-3689','Backhoe Loader','machinery','hours', 957, 500, 500, null, 1000, null, 121820.74,
        'CONFIRM: last service date missing. "C-3689" may be a chassis/fleet number, not a plate.'),
      ('Excavator 1 — JCB','C-8639','Excavator','machinery','hours', null, null, null, null, null, null, 156818.80,
        'NEEDS SETUP: no service data in Excel (only est. cost KES 156,818.80). "C-8639" may be a chassis/fleet number.'),
      ('Excavator 2 — JCB','KHMA267Y','Excavator','machinery','hours', 275, 500, 100, date '2026-07-23', 500, null, 37000,
        'CONFIRM: Excel next service typed as 500 (formula gives 600). Fixed 500-hour marks? If yes set schedule to "Planned".')
    ) as t(name, reg, category, cls, meter, cur, itv, last_m, last_d, next_m, stype, cost, notes)
  loop
    insert into assets (name, registration_number, category, asset_class, meter_type, current_reading, reading_at, notes)
    values (r.name, r.reg, r.category, r.cls::asset_class, r.meter::meter_type, r.cur,
            null,  -- reading date unknown in Excel → shown as "date unknown" and asks for a fresh reading
            r.notes)
    returning id into v_id;

    if r.cur is not null then
      insert into meter_readings (asset_id, reading, reading_at, source, note)
      values (v_id, r.cur, now(), 'import', 'From Excel service schedule (reading date unknown)');
    end if;

    if r.itv is not null or r.next_m is not null then
      insert into service_plans (asset_id, interval_meter, last_service_meter, last_service_date, next_due_meter,
                                 service_type_note, estimated_cost)
      values (v_id, r.itv, r.last_m, r.last_d, r.next_m, r.stype, r.cost);
    end if;
  end loop;
end $$;
