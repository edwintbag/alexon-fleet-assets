import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAttention, type AttentionItem, type Priority } from "@/lib/attention";
import { sendEmail } from "@/lib/email";
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
  const { data: settings } = await supabase.from("app_settings").select("digest_enabled, digest_extra_emails, company_name").single();
  if (!settings?.digest_enabled) return NextResponse.json({ skipped: "digest disabled" });

  const { items } = await loadAttention(supabase);
  const by = (p: Priority) => items.filter((i) => i.priority === p);
  const critical = by("critical"), important = by("important"), normal = by("normal");

  if (critical.length + important.length === 0) {
    return NextResponse.json({ sent: false, reason: "nothing critical or important" });
  }

  const { data: users } = await supabase.from("profiles").select("email").eq("is_active", true).in("role", ["admin", "fleet", "management"]);
  const extra = String(settings.digest_extra_emails ?? "").split(",").map((e) => e.trim()).filter((e) => e.includes("@"));
  const to = [...new Set([...(users ?? []).map((u) => String(u.email)), ...extra])];
  if (to.length === 0) return NextResponse.json({ sent: false, reason: "no recipients" });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#0f172a">
    <div style="background:#1A1870;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0"><strong>Alexon Fleet</strong> — what needs attention · ${formatDate(todayNairobi())}</div>
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
  return NextResponse.json({ sent: result.ok, recipients: to.length, error: result.error });
}
