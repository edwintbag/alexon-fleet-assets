"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth";
import { friendlyError, type ActionState } from "@/lib/errors";
import { parseReading } from "@/lib/format";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const values = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

export async function reportBreakdown(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const v = values(fd);
  if (!s(fd, "asset_id")) return { error: "Choose the asset.", values: v };
  if (s(fd, "description").length < 3) return { error: "Describe the problem.", values: v };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_breakdown", {
    p_asset_id: s(fd, "asset_id"),
    p_description: s(fd, "description"),
    p_severity: s(fd, "severity") || "major",
    p_asset_operable: s(fd, "asset_operable") === "yes",
    p_location: s(fd, "location") || null,
    p_meter: s(fd, "meter_reading") ? parseReading(fd.get("meter_reading")) : null,
  });
  if (error) return { error: friendlyError(error), values: v };
  revalidatePath("/breakdowns"); revalidatePath("/dashboard"); revalidatePath("/assets");
  redirect(`/breakdowns/${data.id}?reported=1`);
}

export async function updateBreakdown(fd: FormData) {
  await requireRole("admin", "fleet");
  const id = s(fd, "id");
  const supabase = await createClient();
  await supabase.from("breakdowns").update({
    status: s(fd, "status"),
    assigned_to: s(fd, "assigned_to") || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  revalidatePath(`/breakdowns/${id}`); revalidatePath("/breakdowns"); revalidatePath("/dashboard");
}

export async function resolveBreakdown(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "fleet");
  const v = values(fd);
  if (s(fd, "resolution").length < 3) return { error: "Say what was done to fix it.", values: v };
  const cost = s(fd, "repair_cost") ? parseReading(fd.get("repair_cost")) : null;
  if (s(fd, "repair_cost") && cost === null) return { error: "Repair cost must be a number.", values: v };

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_breakdown", {
    p_id: s(fd, "id"),
    p_resolution: s(fd, "resolution"),
    p_cost: cost,
    p_back_in_service: s(fd, "back_in_service") !== "no",
  });
  if (error) return { error: friendlyError(error), values: v };
  revalidatePath(`/breakdowns/${s(fd, "id")}`); revalidatePath("/breakdowns"); revalidatePath("/dashboard"); revalidatePath("/assets");
  return { ok: true, message: "Breakdown resolved.", nonce: Date.now() };
}
