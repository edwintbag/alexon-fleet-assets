"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth";
import { friendlyError, type ActionState } from "@/lib/errors";
import { parseReading } from "@/lib/format";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => (s(fd, k) === "" ? null : parseReading(fd.get(k)));
const values = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

export async function createPurchaseRequest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "stores", "fleet");
  const v = values(fd);
  const qty = num(fd, "quantity");
  const description = s(fd, "description");
  if (!description || description.length < 2) return { error: "Say what needs to be bought.", values: v };
  if (!qty || qty <= 0) return { error: "Enter a quantity greater than zero.", values: v };

  const supabase = await createClient();
  const { data: pr, error } = await supabase.from("purchase_requests").insert({
    justification: s(fd, "justification") || null,
    supplier_id: s(fd, "supplier_id") || null,
    needed_by: s(fd, "needed_by") || null,
  }).select("id").single();
  if (error) return { error: friendlyError(error), values: v };

  const { error: itemError } = await supabase.from("purchase_request_items").insert({
    purchase_request_id: pr.id,
    spare_part_id: s(fd, "spare_part_id") || null,
    description,
    quantity: qty,
    estimated_unit_cost: num(fd, "estimated_unit_cost"),
    asset_id: s(fd, "asset_id") || null,
  });
  if (itemError) return { error: friendlyError(itemError), values: v };

  revalidatePath("/purchasing");
  redirect(`/purchasing/${pr.id}?created=1`);
}

export async function addItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "stores", "fleet");
  const v = values(fd);
  const qty = num(fd, "quantity");
  if (s(fd, "description").length < 2) return { error: "Describe the item.", values: v };
  if (!qty || qty <= 0) return { error: "Enter a quantity greater than zero.", values: v };

  const supabase = await createClient();
  const { error } = await supabase.from("purchase_request_items").insert({
    purchase_request_id: s(fd, "purchase_request_id"),
    spare_part_id: s(fd, "spare_part_id") || null,
    description: s(fd, "description"),
    quantity: qty,
    estimated_unit_cost: num(fd, "estimated_unit_cost"),
  });
  if (error) return { error: friendlyError(error), values: v };
  revalidatePath(`/purchasing/${s(fd, "purchase_request_id")}`);
  return { ok: true, message: "Item added.", nonce: Date.now() };
}

export async function removeItem(fd: FormData) {
  await requireRole("admin", "stores", "fleet");
  const supabase = await createClient();
  await supabase.from("purchase_request_items").delete().eq("id", s(fd, "id"));
  revalidatePath(`/purchasing/${s(fd, "purchase_request_id")}`);
}

export async function transitionRequest(fd: FormData) {
  await requireUser();
  const id = s(fd, "id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_purchase_request", {
    p_pr_id: id, p_to: s(fd, "to"), p_note: s(fd, "note") || null,
  });
  revalidatePath(`/purchasing/${id}`); revalidatePath("/purchasing"); revalidatePath("/dashboard");
  if (error) redirect(`/purchasing/${id}?error=${encodeURIComponent(friendlyError(error))}`);
}

export async function receiveItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "stores");
  const v = values(fd);
  const qty = num(fd, "quantity");
  if (!qty || qty <= 0) return { error: "Enter the quantity received.", values: v };

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase_item", {
    p_item_id: s(fd, "item_id"),
    p_quantity: qty,
    p_unit_cost: num(fd, "unit_cost"),
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) return { error: friendlyError(error), values: v };
  revalidatePath(`/purchasing/${s(fd, "purchase_request_id")}`); revalidatePath("/parts"); revalidatePath("/dashboard");
  return { ok: true, message: "Received into stock.", nonce: Date.now() };
}

// ---------------------------------------------------------------------
// Buying plan — regular purchases such as "1 tyre a month"
// ---------------------------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function savePlan(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "stores", "fleet");
  const v = values(fd);
  const qty = num(fd, "quantity");
  const months = Number(s(fd, "cycle_months") || "1");
  const start = s(fd, "next_due_date");
  const assetIds = fd.getAll("asset_ids").map(String).filter((id) => UUID.test(id));

  if (s(fd, "name").length < 3) return { error: "Give the plan a name, e.g. \"Monthly tyres\".", values: v };
  if (s(fd, "description").length < 2) return { error: "Say what is being bought.", values: v };
  if (!qty || qty <= 0) return { error: "Enter a quantity greater than zero.", values: v };
  if (!Number.isInteger(months) || months < 1 || months > 24) return { error: "Choose how often.", values: v };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return { error: "Choose the next date to buy.", values: v };
  const cost = num(fd, "estimated_unit_cost");
  if (s(fd, "estimated_unit_cost") && cost === null) return { error: "Unit cost must be a number.", values: v };

  const payload = {
    name: s(fd, "name"),
    description: s(fd, "description"),
    spare_part_id: s(fd, "spare_part_id") || null,
    quantity: qty,
    cycle_months: months,
    estimated_unit_cost: cost,
    supplier_id: s(fd, "supplier_id") || null,
    asset_ids: assetIds,
    next_due_date: start,
    notes: s(fd, "notes") || null,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  const id = s(fd, "id");
  const { error } = id
    ? await supabase.from("purchase_plans").update(payload).eq("id", id)
    : await supabase.from("purchase_plans").insert(payload);
  if (error) return { error: friendlyError(error), values: v };

  revalidatePath("/purchasing/plans"); revalidatePath("/dashboard");
  redirect(`/purchasing/plans?saved=1`);
}

export async function requestFromPlan(fd: FormData) {
  await requireRole("admin", "stores", "fleet");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_request_from_plan", { p_plan_id: s(fd, "id") });
  revalidatePath("/purchasing"); revalidatePath("/purchasing/plans"); revalidatePath("/dashboard");
  if (error) redirect(`/purchasing/plans?error=${encodeURIComponent(friendlyError(error))}`);
  redirect(`/purchasing/${data.request_id}?created=1`);
}

export async function skipPlan(fd: FormData) {
  await requireRole("admin", "stores", "fleet");
  const supabase = await createClient();
  const { error } = await supabase.rpc("skip_plan_cycle", { p_plan_id: s(fd, "id") });
  revalidatePath("/purchasing/plans"); revalidatePath("/dashboard");
  if (error) redirect(`/purchasing/plans?error=${encodeURIComponent(friendlyError(error))}`);
}

export async function togglePlan(fd: FormData) {
  await requireRole("admin", "stores", "fleet");
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_plans")
    .update({ is_active: s(fd, "active") === "true", updated_at: new Date().toISOString() })
    .eq("id", s(fd, "id"));
  revalidatePath("/purchasing/plans"); revalidatePath("/dashboard");
  if (error) redirect(`/purchasing/plans?error=${encodeURIComponent(friendlyError(error))}`);
}
