"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";

const NUMERIC = [
  "km_approaching", "km_due_soon", "km_due_window", "km_overdue_grace",
  "hours_approaching", "hours_due_soon", "hours_due_window", "hours_overdue_grace",
  "days_approaching", "days_due_soon", "days_due_window",
  "stale_reading_days", "max_km_per_day", "compliance_warning_days",
] as const;

export async function saveSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin");
  const update: Record<string, unknown> = {};
  for (const k of NUMERIC) {
    const raw = String(fd.get(k) ?? "").replace(/,/g, "").trim();
    if (!/^\d+(\.\d+)?$/.test(raw)) return { error: `"${k.replace(/_/g, " ")}" must be a number.` };
    update[k] = Number(raw);
  }
  const t = (p: string) => [update[`${p}_approaching`], update[`${p}_due_soon`], update[`${p}_due_window`]] as number[];
  for (const p of ["km", "hours", "days"]) {
    const [a, s, w] = t(p);
    if (!(a > s && s >= w)) return { error: `${p.toUpperCase()}: Approaching must be bigger than Due soon, and Due soon at least the Due window.` };
  }
  update.digest_enabled = fd.get("digest_enabled") === "on";
  update.digest_extra_emails = String(fd.get("digest_extra_emails") ?? "").trim();
  update.updated_at = new Date().toISOString();

  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").update(update).eq("id", true);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved. Statuses have been recalculated." };
}
