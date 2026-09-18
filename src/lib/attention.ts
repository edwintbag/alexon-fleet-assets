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
  assetClass: string | null;   // vehicle | machinery | trailer | equipment | null (stores items)
  reg: string;
  headline: string;
  detail: string;
  /** the one number that matters, e.g. "1,240 km over" or "in 6 days" */
  metric: string | null;
  metricNote: string | null;
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
  asset_class?: string | null;
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

/** vehicles first, then machinery, then the rest, then stores/purchasing items */
export const CLASS_ORDER: Record<string, number> = { vehicle: 0, machinery: 1, trailer: 2, equipment: 3 };
export const CLASS_LABEL: Record<string, string> = {
  vehicle: "Vehicles", machinery: "Machinery & plant", trailer: "Trailers", equipment: "Equipment",
};
export const classRank = (c: string | null) => (c ? CLASS_ORDER[c] ?? 4 : 9);

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

export type BreakdownRow = {
  id: string; breakdown_number: string; asset_id: string; asset_name: string; registration_number: string | null;
  description: string; asset_class?: string | null; severity: "critical" | "major" | "minor"; status: "reported" | "in_progress" | "awaiting_parts" | "resolved";
  asset_operable: boolean; reported_at: string; reported_by_name: string | null; assigned_to_name: string | null;
  location: string | null; hours_down: number; resolution_notes: string | null; repair_cost: number | null; resolved_at: string | null;
  meter_type: "km" | "hours" | "none"; meter_reading: number | null;
};

export type PartRow = {
  id: string; name: string; part_number: string | null; category: string | null; unit: string;
  current_stock: number; minimum_stock: number; reorder_quantity: number | null; average_cost: number;
  supplier_id: string | null; supplier_name: string | null; location: string | null; notes: string | null;
  stock_status: "ok" | "low" | "out_of_stock"; on_order: number;
};

export type PurchaseRequestRow = {
  id: string; request_number: string; status: "draft" | "submitted" | "approved" | "rejected" | "ordered" | "received" | "cancelled";
  supplier_id: string | null; supplier_name: string | null; needed_by: string | null; justification: string | null;
  requested_by: string | null; requested_by_name: string | null; approved_by_name: string | null; approved_at: string | null;
  rejection_reason: string | null; created_at: string; item_count: number; estimated_total: number;
};

/** Release 2 tables may not exist yet — never let that break the dashboard */
async function safeSelect<T>(supabase: SupabaseClient, view: string, build: (q: any) => any): Promise<T[]> {
  try {
    const { data, error } = await build(supabase.from(view).select("*"));
    if (error) return [];
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

export async function loadAttention(supabase: SupabaseClient) {
  const [{ data: assets, error: e1 }, { data: docs, error: e2 }, breakdowns, parts, prs] = await Promise.all([
    supabase.from("v_asset_service_status").select("*").is("archived_at", null),
    supabase.from("v_compliance_status").select("*").neq("status", "valid"),
    safeSelect<BreakdownRow>(supabase, "v_breakdowns", (q) => q.neq("status", "resolved")),
    safeSelect<PartRow>(supabase, "v_part_stock_status", (q) => q.neq("stock_status", "ok")),
    safeSelect<PurchaseRequestRow>(supabase, "v_purchase_requests", (q) => q.eq("status", "submitted")),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const rows = (assets ?? []) as AssetStatusRow[];
  const items: AttentionItem[] = [];

  for (const a of rows) {
    if (a.operational_status === "disposed") continue;
    const base = { assetId: a.id, assetName: a.name, assetClass: a.asset_class, reg: formatReg(a.registration_number) };

    if (a.operational_status === "breakdown" && !breakdowns.some((b) => b.asset_id === a.id)) {
      items.push({
        ...base, key: `bd-${a.id}`, priority: "critical", kind: "breakdown",
        headline: "Broken down", detail: "Marked as broken down — no breakdown report on file.",
        metric: "Down", metricNote: null,
        action: { label: "Report details", href: `/breakdowns/new?asset=${a.id}` }, sort: 0,
      });
    }

    const s = a.service_status;
    if (s === "overdue" || s === "due" || s === "due_soon" || s === "approaching") {
      const priority: Priority = s === "overdue" ? "critical" : s === "approaching" ? "normal" : "important";
      const headline = s === "overdue" ? "Service overdue" : s === "due" ? "Service due" : s === "due_soon" ? "Service due soon" : "Service approaching";
      const u = unitFor(a.meter_type);
      const metric =
        a.remaining_meter !== null
          ? a.remaining_meter < 0 ? `${formatNumber(-a.remaining_meter)} ${u} over` : `${formatNumber(a.remaining_meter)} ${u} left`
          : a.remaining_days !== null
            ? a.remaining_days < 0 ? `${-a.remaining_days} days over` : `in ${a.remaining_days} days`
            : null;
      items.push({
        ...base, key: `svc-${a.id}`, priority, kind: "service", headline,
        detail: [
          a.next_due_meter !== null ? `Next service at ${formatNumber(a.next_due_meter)} ${u}` : a.next_due_date ? `Due ${formatDate(a.next_due_date)}` : "",
          a.current_reading !== null ? `now ${formatNumber(a.current_reading)} ${u}` : "",
        ].filter(Boolean).join(" · "),
        metric,
        metricNote: a.reading_stale && a.meter_type !== "none" ? `reading ${a.reading_at ? daysAgo(a.reading_age_days) : "undated"}` : null,
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
        metric: "Not set", metricNote: null,
        action: { label: "Set up", href: `/assets/${a.id}#plan` }, sort: 0,
      });
    } else if (a.meter_type !== "none" && a.reading_stale) {
      items.push({
        ...base, key: `read-${a.id}`, priority: "important", kind: "reading",
        headline: "Update reading",
        detail: a.reading_at
          ? `Last seen at ${formatMeter(a.current_reading, a.meter_type)} — service status may be wrong`
          : `Imported from Excel with no date — take a fresh reading`,
        metric: a.reading_at ? daysAgo(a.reading_age_days) : "undated",
        metricNote: null,
        action: { label: "Update reading", href: `/assets/${a.id}#reading` }, sort: -(a.reading_age_days ?? 9999),
      });
    }
  }

  for (const d of (docs ?? []) as ComplianceRow[]) {
    const priority: Priority = d.status === "expired" ? "critical" : d.days_remaining <= 7 ? "important" : "normal";
    items.push({
      key: `doc-${d.id}`, priority, kind: "compliance",
      assetId: d.asset_id, assetName: d.asset_name ?? "Company document", assetClass: d.asset_class ?? null, reg: formatReg(d.registration_number),
      headline: d.status === "expired" ? `${d.document_type} expired` : `${d.document_type} expiring`,
      detail: `${d.issuer ? d.issuer + " · " : ""}expiry ${formatDate(d.expiry_date)}`,
      metric: d.days_remaining < 0 ? `${Math.abs(d.days_remaining)} days over` : d.days_remaining === 0 ? "today" : `in ${d.days_remaining} days`,
      metricNote: null,
      action: { label: "Renew", href: `/compliance/new?renew=${d.id}` },
      sort: d.days_remaining,
    });
  }

  for (const b of breakdowns) {
    const priority: Priority = b.severity === "critical" || !b.asset_operable ? "critical" : b.severity === "major" ? "important" : "normal";
    const days = Math.floor(b.hours_down / 24);
    items.push({
      key: `bdr-${b.id}`, priority, kind: "breakdown",
      assetId: b.asset_id, assetName: b.asset_name, assetClass: b.asset_class ?? null, reg: formatReg(b.registration_number),
      headline: b.asset_operable ? `Breakdown — ${b.severity}` : "Breakdown — off the road",
      detail: `${b.breakdown_number} · ${b.description}`.slice(0, 120),
      metric: days >= 1 ? `${days} days down` : `${Math.round(b.hours_down)}h down`,
      metricNote: b.assigned_to_name ? `with ${b.assigned_to_name}` : null,
      action: { label: "Open", href: `/breakdowns/${b.id}` },
      sort: -b.hours_down,
    });
  }

  for (const p of parts) {
    if (p.on_order > 0) continue;   // already being bought
    const out = p.stock_status === "out_of_stock";
    items.push({
      key: `stk-${p.id}`, priority: out ? "important" : "normal", kind: "setup",
      assetId: null, assetName: p.name, assetClass: null, reg: p.part_number ?? "—",
      headline: out ? "Out of stock" : "Low stock",
      detail: `Minimum ${formatNumber(p.minimum_stock)} ${p.unit}${p.supplier_name ? ` · ${p.supplier_name}` : ""}`,
      metric: `${formatNumber(p.current_stock)} ${p.unit} left`,
      metricNote: null,
      action: { label: "Order", href: `/purchasing/new?part=${p.id}` },
      sort: p.current_stock,
    });
  }

  for (const r of prs) {
    const days = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000);
    items.push({
      key: `pr-${r.id}`, priority: days >= 2 ? "important" : "normal", kind: "setup",
      assetId: null, assetName: `Purchase request ${r.request_number}`, assetClass: null, reg: "—",
      headline: "Waiting for approval",
      detail: `${r.item_count} item(s)${r.requested_by_name ? ` · from ${r.requested_by_name}` : ""}`,
      metric: days === 0 ? "today" : `${days} days waiting`,
      metricNote: null,
      action: { label: "Review", href: `/purchasing/${r.id}` },
      sort: -days,
    });
  }

  items.sort((x, y) =>
    PRIORITY_ORDER[x.priority] - PRIORITY_ORDER[y.priority] ||
    classRank(x.assetClass) - classRank(y.assetClass) ||
    x.sort - y.sort);
  return { items, assets: rows, docs: (docs ?? []) as ComplianceRow[], breakdowns, parts, prs };
}
