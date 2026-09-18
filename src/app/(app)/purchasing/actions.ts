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
