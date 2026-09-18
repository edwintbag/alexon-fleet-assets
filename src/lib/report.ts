import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate, formatKES, formatNumber } from "@/lib/format";

export type ManagementReport = {
  from: string; to: string;
  assets: { total: number; operational: number; maintenance: number; breakdown: number; standby: number };
  service: { overdue: number; due: number; stale_readings: number };
  services_done: { count: number; cost: number };
  breakdowns: { reported: number; resolved: number; cost: number; downtime_hours: number };
  compliance: { expired: number; expiring: number };
  parts: { low: number; out: number; stock_value: number };
  purchasing: { awaiting_approval: number; received_value: number };
  top_costs: { name: string; reg: string | null; total: number; service_cost: number; repair_cost: number }[];
};

export type Period = "week" | "month";

export function periodRange(period: Period, today = new Date()): { from: string; to: string; label: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(today);
  if (period === "week") {
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return { from: iso(start), to: iso(end), label: `Week to ${formatDate(iso(end))}` };
  }
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (end.getUTCDate() <= 7 ? 1 : 0), 1));
  const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const to = last < end ? last : end;
  return {
    from: iso(start), to: iso(to),
    label: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(start),
  };
}

export async function getReport(supabase: SupabaseClient, from: string, to: string): Promise<ManagementReport | null> {
  const { data, error } = await supabase.rpc("management_report", { p_from: from, p_to: to });
  if (error || !data) return null;
  return data as ManagementReport;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function reportHtml(r: ManagementReport, title: string, appUrl: string): string {
  const cell = (label: string, value: string, tone?: "red" | "amber") =>
    `<td style="padding:10px 12px;border:1px solid #e2e8f0;vertical-align:top">
       <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b">${esc(label)}</div>
       <div style="font-size:20px;font-weight:600;color:${tone === "red" ? "#dc2626" : tone === "amber" ? "#b45309" : "#0f172a"}">${esc(value)}</div>
     </td>`;

  const topRows = r.top_costs.length
    ? r.top_costs.map((t) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(t.name)}${t.reg ? ` <span style="color:#94a3b8">${esc(t.reg)}</span>` : ""}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${esc(formatKES(t.service_cost))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${esc(formatKES(t.repair_cost))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${esc(formatKES(t.total))}</td>
      </tr>`).join("")
    : `<tr><td colspan="4" style="padding:10px;color:#64748b">No maintenance spend recorded in this period.</td></tr>`;

  const totalSpend = Number(r.services_done.cost) + Number(r.breakdowns.cost);

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:auto;color:#0f172a">
    <div style="background:#1A1870;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <div style="font-size:18px;font-weight:700">Alexon Fleet — ${esc(title)}</div>
      <div style="font-size:12px;opacity:.75">${esc(formatDate(r.from))} to ${esc(formatDate(r.to))}</div>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:0;padding:18px 20px;border-radius:0 0 8px 8px">

      <h3 style="margin:0 0 8px;font-size:14px">Fleet</h3>
      <table style="border-collapse:collapse;width:100%"><tr>
        ${cell("Assets", String(r.assets.total))}
        ${cell("Operational", String(r.assets.operational))}
        ${cell("In maintenance", String(r.assets.maintenance), r.assets.maintenance ? "amber" : undefined)}
        ${cell("Broken down", String(r.assets.breakdown), r.assets.breakdown ? "red" : undefined)}
      </tr></table>

      <h3 style="margin:18px 0 8px;font-size:14px">Servicing</h3>
      <table style="border-collapse:collapse;width:100%"><tr>
        ${cell("Services done", String(r.services_done.count))}
        ${cell("Service spend", formatKES(r.services_done.cost))}
        ${cell("Overdue now", String(r.service.overdue), r.service.overdue ? "red" : undefined)}
        ${cell("Due soon", String(r.service.due), r.service.due ? "amber" : undefined)}
      </tr></table>

      <h3 style="margin:18px 0 8px;font-size:14px">Breakdowns &amp; compliance</h3>
      <table style="border-collapse:collapse;width:100%"><tr>
        ${cell("Breakdowns", String(r.breakdowns.reported))}
        ${cell("Downtime", `${formatNumber(r.breakdowns.downtime_hours, 1)} hrs`)}
        ${cell("Repair spend", formatKES(r.breakdowns.cost))}
        ${cell("Docs expired", String(r.compliance.expired), r.compliance.expired ? "red" : undefined)}
      </tr></table>

      <h3 style="margin:18px 0 8px;font-size:14px">Stores</h3>
      <table style="border-collapse:collapse;width:100%"><tr>
        ${cell("Stock value", formatKES(r.parts.stock_value))}
        ${cell("Low / out", `${r.parts.low} / ${r.parts.out}`, r.parts.out ? "red" : r.parts.low ? "amber" : undefined)}
        ${cell("Received", formatKES(r.purchasing.received_value))}
        ${cell("Awaiting approval", String(r.purchasing.awaiting_approval), r.purchasing.awaiting_approval ? "amber" : undefined)}
      </tr></table>

      <h3 style="margin:18px 0 8px;font-size:14px">Total maintenance spend: ${esc(formatKES(totalSpend))}</h3>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <tr style="text-align:left;color:#64748b;font-size:11px;text-transform:uppercase">
          <th style="padding:6px 10px">Asset</th><th style="padding:6px 10px;text-align:right">Service</th>
          <th style="padding:6px 10px;text-align:right">Repairs</th><th style="padding:6px 10px;text-align:right">Total</th>
        </tr>
        ${topRows}
      </table>

      ${r.service.stale_readings > 0 ? `<p style="margin-top:16px;color:#b45309;font-size:13px">
        ${r.service.stale_readings} asset(s) have an out-of-date KM/hours reading, so their service status may be wrong.</p>` : ""}

      <p style="margin-top:20px">
        <a href="${appUrl}/reports" style="background:#1A1870;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open the report</a>
      </p>
    </div>
  </div>`;
}
