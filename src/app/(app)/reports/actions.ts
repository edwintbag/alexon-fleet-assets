"use server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getReport, periodRange, reportHtml, type Period } from "@/lib/report";
import { sendEmail } from "@/lib/email";
import type { ActionState } from "@/lib/errors";

export async function emailReport(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "management");
  const period = (String(fd.get("period")) === "month" ? "month" : "week") as Period;
  const supabase = await createClient();

  const { from, to, label } = periodRange(period);
  const report = await getReport(supabase, from, to);
  if (!report) return { error: "Could not build the report." };

  const { data: managers } = await supabase.from("profiles").select("email").eq("is_active", true).in("role", ["admin", "management"]);
  const { data: settings } = await supabase.from("app_settings").select("report_extra_emails").maybeSingle();
  const extra = String(settings?.report_extra_emails ?? "").split(",").map((e) => e.trim()).filter((e) => e.includes("@"));
  const to_ = [...new Set([...(managers ?? []).map((m) => String(m.email)), ...extra])];
  if (to_.length === 0) return { error: "No management email addresses to send to." };

  const title = period === "week" ? `Weekly summary — ${label}` : `Monthly summary — ${label}`;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const res = await sendEmail(to_, `Alexon Fleet: ${title}`, reportHtml(report, title, appUrl));
  if (!res.ok) return { error: `Email not sent: ${res.error}` };
  return { ok: true, message: `Sent to ${to_.length} recipient(s).`, nonce: Date.now() };
}
