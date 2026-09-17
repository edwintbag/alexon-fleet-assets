# Alexon Fleet & Asset Management System — Release 1

Internal system that answers **"What needs my attention today?"** for Alexon Group's vehicles and machinery.

**Setup:** see [SETUP.md](SETUP.md).

## Release 1 includes
- Sign-in with roles: Admin, Fleet/Logistics, Stores/Procurement, Management
- Fleet register (vehicles, machinery, trailers) with search, filters and CSV export
- KM / engine-hours readings with safety checks (no lower readings, no impossible hours, confirm big jumps)
- Service plans by KM, hours and/or days; statuses OK → Approaching → Due soon → Due → Overdue (thresholds editable in Settings)
- Mark service complete → next service calculated automatically (from actual reading, or fixed planned marks)
- Service history with costs
- Compliance documents with expiry tracking, file upload and renewal
- Dashboard Action Center, sorted by priority
- Daily 7:00 am email of critical and important items
- Audit log of all changes (database), mobile-friendly layout

## Planned for Release 2
Breakdowns, spare parts & stock, purchase requests, more reports, QR codes, WhatsApp alerts.

## Structure
```
supabase/01_schema.sql                 database: tables, rules, security, functions
supabase/02_seed_assets_from_excel.sql the 12 assets from the Excel schedule
src/app/(app)/...                      pages (dashboard, assets, compliance, users, settings)
src/app/api/cron/daily-digest          daily email job
src/lib/attention.ts                   what goes into the Action Center and email
src/lib/...                            auth, formatting, statuses
```
Business rules (status calculation, reading validation, service completion) live in the database
functions so every screen and the email use the same logic.
