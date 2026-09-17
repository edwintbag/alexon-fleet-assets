import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate, formatMeter, formatNumber, formatReg, unitFor, daysAgo } from "@/lib/format";
import type { ServiceStatus, ComplianceStatus } from "@/lib/status";

export type Priority = "critical" | "important" | "normal";

export type AttentionItem = {
  key: string;
  priority: Priority;
  kind: "service" | "reading" | "setup" | "compliance" | "breakdown";
  assetId: string | null;
  assetName: string;
  reg: string;
  headline: string;
  detail: string;
  action: { label: string; href: string } | null;
  sort: number;
};

export type AssetStatusRow = {
  id: string;
  name: string;
  registration_number: string | null;
  category: string;
  asset_class: string;
  meter_type: "km" | "hours" | "none";
  current_reading: number | null;
  reading_at: string | null;
  operational_status: string;
  archived_at: string | null;
  has_plan: boolean;
  interval_meter: number | null;
  interval_days: number | null;
  last_service_meter: number | null;
  last_service_date: string | null;
  next_due_meter: number | null;
  next_due_date: string | null;
  schedule_anchor: "actual" | "planned";
  service_type_note: string | null;
  estimated_cost: number | null;
  remaining_meter: number | null;
  remaining_days: number | null;
  reading_stale: boolean;
  reading_age_days: number | null;
  meter_status: ServiceStatus | null;
  date_status: ServiceStatus | null;
  service_status: ServiceStatus;
  responsible_user_id: string | null;
};

export type ComplianceRow = {
  id: string;
  asset_id: string | null;
  asset_name: string | null;
  registration_number: string | null;
  document_type: string;
  document_number: string | null;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string;
  cost: number | null;
  file_path: string | null;
  notes: string | null;
  days_remaining: number;
  status: ComplianceStatus;
};

const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, important: 1, normal: 2 };

function remainingText(row: AssetStatusRow): string {
  const parts: string[] = [];
  if (row.remaining_meter !== null) {
    const u = unitFor(row.meter_type);
    parts.push(
      row.remaining_meter < 0
        ? `overdue by ${formatNumber(Math.abs(row.remaining_meter))} ${u}`
        : `${formatNumber(row.remaining_meter)} ${u} to go`,
    );
  }
  if (row.remaining_days !== null) {
    parts.push(
      row.remaining_days < 0
        ? `${Math.abs(row.remaining_days)} days past due date`
        : `due date ${formatDate(row.next_due_date)}`,
    );
  }
  return parts.join(" · ");
}

export async function loadAttention(supabase: SupabaseClient) {
  const [{ data: assets, error: e1 }, { data: docs, error: e2 }] = await Promise.all([
    supabase.from("v_asset_service_status").select("*").is("archived_at", null),
    supabase.from("v_compliance_status").select("*").neq("status", "valid"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const rows = (assets ?? []) as AssetStatusRow[];
  const items: AttentionItem[] = [];

  for (const a of rows) {
    if (a.operational_status === "disposed") continue;
    const base = { assetId: a.id, assetName: a.name, reg: formatReg(a.registration_number) };

    if (a.operational_status === "breakdown") {
      items.push({
        ...base, key: `bd-${a.id}`, priority: "critical", kind: "breakdown",
        headline: "Broken down", detail: "Asset is marked as broken down.",
        action: { label: "View asset", href: `/assets/${a.id}` }, sort: 0,
      });
    }

    const s = a.service_status;
    if (s === "overdue" || s === "due" || s === "due_soon" || s === "approaching") {
      const priority: Priority = s === "overdue" ? "critical" : s === "approaching" ? "normal" : "important";
      const headline = s === "overdue" ? "Service overdue" : s === "due" ? "Service due" : s === "due_soon" ? "Service due soon" : "Service approaching";
      items.push({
        ...base, key: `svc-${a.id}`, priority, kind: "service", headline,
        detail: remainingText(a) + (a.reading_stale && a.meter_type !== "none" ? ` (reading ${daysAgo(a.reading_age_days)})` : ""),
        action: { label: "Mark serviced", href: `/assets/${a.id}#service` },
        sort: a.remaining_meter ?? a.remaining_days ?? 0,
      });
    }

    const needsSetup = !a.has_plan || (a.next_due_meter === null && a.next_due_date === null) || (a.meter_type !== "none" && a.current_reading === null);
    if (needsSetup) {
      items.push({
        ...base, key: `setup-${a.id}`, priority: "normal", kind: "setup",
        headline: "Needs setup",
        detail: !a.has_plan ? "No service plan (interval / last service) yet." : a.meter_type !== "none" && a.current_reading === null ? "No current reading yet." : "Next service point not set.",
        action: { label: "Set up", href: `/assets/${a.id}#plan` }, sort: 0,
      });
    } else if (a.meter_type !== "none" && a.reading_stale) {
      items.push({
        ...base, key: `read-${a.id}`, priority: "important", kind: "reading",
        headline: "Update reading",
        detail: a.reading_at
          ? `Last reading ${formatMeter(a.current_reading, a.meter_type)}, ${daysAgo(a.reading_age_days)}`
          : `Reading ${formatMeter(a.current_reading, a.meter_type)} has no date — take a fresh reading`,
        action: { label: "Update reading", href: `/assets/${a.id}#reading` }, sort: -(a.reading_age_days ?? 9999),
      });
    }
  }

  for (const d of (docs ?? []) as ComplianceRow[]) {
    const priority: Priority = d.status === "expired" ? "critical" : d.days_remaining <= 7 ? "important" : "normal";
    items.push({
      key: `doc-${d.id}`, priority, kind: "compliance",
      assetId: d.asset_id, assetName: d.asset_name ?? "Company document", reg: formatReg(d.registration_number),
      headline: d.status === "expired" ? `${d.document_type} expired` : `${d.document_type} expiring`,
      detail: d.days_remaining < 0
        ? `Expired ${Math.abs(d.days_remaining)} day(s) ago (${formatDate(d.expiry_date)})`
        : d.days_remaining === 0 ? `Expires today` : `Expires in ${d.days_remaining} day(s) — ${formatDate(d.expiry_date)}`,
      action: { label: "Renew", href: `/compliance/new?renew=${d.id}` },
      sort: d.days_remaining,
    });
  }

  items.sort((x, y) => PRIORITY_ORDER[x.priority] - PRIORITY_ORDER[y.priority] || x.sort - y.sort);
  return { items, assets: rows, docs: (docs ?? []) as ComplianceRow[] };
}
