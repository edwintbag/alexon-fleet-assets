"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { friendlyError, type ActionState } from "@/lib/errors";
import { parseReading } from "@/lib/format";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => (s(fd, k) === "" ? null : parseReading(fd.get(k)));
const values = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

export async function savePart(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "stores");
  const v = values(fd);
  if (s(fd, "name").length < 2) return { error: "Enter the part name.", values: v };
  const min = num(fd, "minimum_stock") ?? 0;
  const reorder = num(fd, "reorder_quantity");
  if (min < 0) return { error: "Minimum stock cannot be negative.", values: v };

  const payload = {
    name: s(fd, "name"),
    part_number: s(fd, "part_number") || null,
    category: s(fd, "category") || null,
    unit: s(fd, "unit") || "pcs",
    minimum_stock: min,
    reorder_quantity: reorder,
    supplier_id: s(fd, "supplier_id") || null,
    location: s(fd, "location") || null,
    notes: s(fd, "notes") || null,
  };

  const supabase = await createClient();
  const id = s(fd, "id");
  if (id) {
    const { error } = await supabase.from("spare_parts").update(payload).eq("id", id);
    if (error) return { error: friendlyError(error), values: v };
    revalidatePath(`/parts/${id}`); revalidatePath("/parts");
    return { ok: true, message: "Part saved.", nonce: Date.now() };
  }

  const { data, error } = await supabase.from("spare_parts").insert(payload).select("id").single();
  if (error) return { error: friendlyError(error), values: v };

  const opening = num(fd, "opening_stock");
  if (opening && opening > 0) {
    await supabase.rpc("record_stock_movement", {
      p_part_id: data.id, p_type: "opening_balance", p_quantity: opening,
      p_idempotency_key: crypto.randomUUID(), p_unit_cost: num(fd, "opening_cost"),
      p_reason: "Opening balance",
    });
  }
  revalidatePath("/parts");
  redirect(`/parts/${data.id}?created=1`);
}

export async function recordMovement(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "stores", "fleet");
  const v = values(fd);
  const qty = num(fd, "quantity");
  if (!qty || qty <= 0) return { error: "Enter a quantity greater than zero.", values: v };
  const type = s(fd, "movement_type");

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_movement", {
    p_part_id: s(fd, "part_id"),
    p_type: type,
    p_quantity: qty,
    p_idempotency_key: s(fd, "idempotency_key") || crypto.randomUUID(),
    p_unit_cost: num(fd, "unit_cost"),
    p_asset_id: s(fd, "asset_id") || null,
    p_reference: s(fd, "reference") || null,
    p_reason: s(fd, "reason") || null,
  });
  if (error) return { error: friendlyError(error), values: v };
  revalidatePath(`/parts/${s(fd, "part_id")}`); revalidatePath("/parts"); revalidatePath("/dashboard");
  return { ok: true, message: "Stock updated.", nonce: Date.now() };
}

export async function saveSupplier(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "stores");
  const v = values(fd);
  if (s(fd, "name").length < 2) return { error: "Enter the supplier name.", values: v };
  const payload = {
    name: s(fd, "name"), contact_person: s(fd, "contact_person") || null,
    phone: s(fd, "phone") || null, email: s(fd, "email") || null,
    supplies: s(fd, "supplies") || null, updated_at: new Date().toISOString(),
  };
  const supabase = await createClient();
  const id = s(fd, "id");
  const { error } = id
    ? await supabase.from("suppliers").update(payload).eq("id", id)
    : await supabase.from("suppliers").insert(payload);
  if (error) return { error: friendlyError(error), values: v };
  revalidatePath("/purchasing/suppliers"); revalidatePath("/parts");
  return { ok: true, message: "Supplier saved.", nonce: Date.now() };
}
