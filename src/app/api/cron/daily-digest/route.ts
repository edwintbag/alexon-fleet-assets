import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAttention, type AttentionItem, type Priority } from "@/lib/attention";
import { sendEmail } from "@/lib/email";
import { getReport, periodRange, reportHtml, type Period } from "@/lib/report";
import { formatDate, todayNairobi } from "@/lib/format";

export const dynamic = "force-dynamic";

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function section(title: string, color: string, items: AttentionItem[], appUrl: string) {
  if (items.length === 0) return "";
  const rows = items
    .map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">
      <strong style="color:${color}">${esc(i.headline)}</strong> · ${esc(i.assetName)}${i.reg !== "—" ? ` (${esc(i.reg)})` : ""}<br>
      <span style="color:#475569">${esc(i.detail)}</span>
      ${i.action ? `<br><a href="${appUrl}${i.action.href}" style="color:#1A1870">${esc(i.action.label)} →</a>` : ""}
    </td></tr>`)
    .join("");
  return `<h3 style="margin:20px 0 6px;color:${color}">${title} (${items.length})</h3><table width="100%" cellspacing="0">${rows}</table>`;
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: settings } = await supabase.from("app_settings").select("*").single();
  const appUrlEarly = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!settings?.digest_enabled) {
    const reports = await maybeSendReports(supabase, settings ?? {}, appUrlEarly);
    return NextResponse.json({ skipped: "daily digest disabled", reports });
  }

  const { items } = await loadAttention(supabase);
  const by = (p: Priority) => items.filter((i) => i.priority === p);
  const critical = by("critical"), important = by("important"), normal = by("normal");

  if (critical.length + important.length === 0) {
    const reports = await maybeSendReports(supabase, settings, appUrlEarly);
    return NextResponse.json({ sent: false, reason: "nothing critical or important", reports });
  }

  const { data: users } = await supabase.from("profiles").select("email").eq("is_active", true).in("role", ["admin", "fleet", "management"]);
  const extra = String(settings.digest_extra_emails ?? "").split(",").map((e) => e.trim()).filter((e) => e.includes("@"));
  const to = [...new Set([...(users ?? []).map((u) => String(u.email)), ...extra])];
  if (to.length === 0) {
    const reports = await maybeSendReports(supabase, settings, appUrlEarly);
    return NextResponse.json({ sent: false, reason: "no recipients", reports });
  }

  const appUrl = appUrlEarly;
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#0f172a">
    <div style="background:#1A1870;color:#fff;padding:16px 18px;border-radius:8px 8px 0 0">
      ${appUrl ? `<img src="${appUrl}/brand/email-logo.png" alt="Alexon Group Ltd" width="150" height="45" style="display:block;border:0;margin-bottom:8px">` : ""}
      <strong>Fleet</strong> — what needs attention · ${formatDate(todayNairobi())}
    </div>
    <div style="border:1px solid #e2e8f0;border-top:0;padding:8px 18px 18px;border-radius:0 0 8px 8px">
      <p>${critical.length} critical · ${important.length} important · ${normal.length} normal</p>
      ${section("Critical", "#dc2626", critical, appUrl)}
      ${section("Important", "#b45309", important, appUrl)}
      ${normal.length ? `<p style="margin-top:18px;color:#475569">${normal.length} lower-priority item(s) — see the dashboard.</p>` : ""}
      <p style="margin-top:20px"><a href="${appUrl}/dashboard" style="background:#1A1870;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open dashboard</a></p>
    </div></div>`;

  const subject = `Fleet: ${critical.length} critical, ${important.length} important — ${formatDate(todayNairobi())}`;
  const result = await sendEmail(to, subject, html);
  await supabase.from("audit_logs").insert({ action: "digest", entity: "email", details: { to: to.length, critical: critical.length, important: important.length, ok: result.ok, error: result.error ?? null } });

  const reports = await maybeSendReports(supabase, settings, appUrl);
  return NextResponse.json({ sent: result.ok, recipients: to.length, error: result.error, reports });
}

/** Management reports ride on the same daily job: weekly on Mondays, monthly on the 1st. */
async function maybeSendReports(
  supabase: ReturnType<typeof createAdminClient>,
  settings: { weekly_report_enabled?: boolean; monthly_report_enabled?: boolean; report_extra_emails?: string },
  appUrl: string,
) {
  const nairobi = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
  const due: Period[] = [];
  if (nairobi.getDay() === 1 && settings.weekly_report_enabled !== false) due.push("week");
  if (nairobi.getDate() === 1 && settings.monthly_report_enabled !== false) due.push("month");
  if (due.length === 0) return [];

  const { data: managers } = await supabase.from("profiles").select("email").eq("is_active", true).in("role", ["admin", "management"]);
  const extra = String(settings.report_extra_emails ?? "").split(",").map((e) => e.trim()).filter((e) => e.includes("@"));
  const to = [...new Set([...(managers ?? []).map((m) => String(m.email)), ...extra])];
  if (to.length === 0) return [{ period: "none", sent: false, reason: "no recipients" }];

  const out = [];
  for (const period of due) {
    const { from, to: until, label } = periodRange(period, nairobi);
    const report = await getReport(supabase, from, until);
    if (!report) { out.push({ period, sent: false, reason: "no data" }); continue; }
    const title = period === "week" ? `Weekly summary — ${label}` : `Monthly summary — ${label}`;
    const res = await sendEmail(to, `Alexon Fleet: ${title}`, reportHtml(report, title, appUrl));
    await supabase.from("audit_logs").insert({ action: `report.${period}`, entity: "email", details: { to: to.length, ok: res.ok, error: res.error ?? null } });
    out.push({ period, sent: res.ok, recipients: to.length, error: res.error });
  }
  return out;
}
