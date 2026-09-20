"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { friendlyError, type ActionState } from "@/lib/errors";
import { parseReading, todayNairobi } from "@/lib/format";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const optStr = (v: FormDataEntryValue | null) => str(v) || null;
const optNum = (v: FormDataEntryValue | null) => (str(v) === "" ? null : parseReading(v));
const valuesOf = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

const assetSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  registration_number: z.string().max(20).nullable(),
  category: z.string().max(60),
  asset_class: z.enum(["vehicle", "machinery", "trailer", "equipment"]),
  make: z.string().max(60).nullable(),
  model: z.string().max(60).nullable(),
  meter_type: z.enum(["km", "hours", "none"]),
  operational_status: z.enum(["operational", "under_maintenance", "breakdown", "standby", "disposed"]),
  responsible_user_id: z.string().uuid().nullable(),
  notes: z.string().max(2000).nullable(),
  driver_name: z.string().max(80).nullable(),
  co_driver_name: z.string().max(80).nullable(),
});

function readAsset(fd: FormData) {
  return assetSchema.safeParse({
    name: str(fd.get("name")),
    registration_number: optStr(fd.get("registration_number")),
    category: str(fd.get("category")),
    asset_class: str(fd.get("asset_class")),
    make: optStr(fd.get("make")),
    model: optStr(fd.get("model")),
    meter_type: str(fd.get("meter_type")),
    operational_status: str(fd.get("operational_status")) || "operational",
    responsible_user_id: optStr(fd.get("responsible_user_id")),
    notes: optStr(fd.get("notes")),
    driver_name: optStr(fd.get("driver_name")),
    co_driver_name: optStr(fd.get("co_driver_name")),
  });
}

export async function createAsset(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "fleet");
  const parsed = readAsset(fd);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form.", values: valuesOf(fd) };

  const supabase = await createClient();
  const { data, error } = await supabase.from("assets").insert(parsed.data).select("id").single();
  if (error) return { error: friendlyError(error), values: valuesOf(fd) };

  const initial = optNum(fd.get("initial_reading"));
  let note = "";
  if (initial !== null && parsed.data.meter_type !== "none") {
    const { error: rErr } = await supabase.rpc("record_meter_reading", { p_asset_id: data.id, p_reading: initial });
    if (rErr) note = "&reading_error=1";
  }
  revalidatePath("/assets");
  redirect(`/assets/${data.id}?created=1${note}#plan`);
}

export async function updateAsset(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "fleet");
  const id = str(fd.get("id"));
  const parsed = readAsset(fd);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form.", values: valuesOf(fd) };
  const supabase = await createClient();
  const { error } = await supabase.from("assets").update(parsed.data).eq("id", id);
  if (error) return { error: friendlyError(error), values: valuesOf(fd) };
  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  redirect(`/assets/${id}?saved=1`);
}

export async function archiveAsset(fd: FormData) {
  await requireRole("admin");
  const id = str(fd.get("id"));
  const supabase = await createClient();
  await supabase.from("assets").update({ archived_at: new Date().toISOString(), operational_status: "disposed" }).eq("id", id);
  revalidatePath("/assets");
  redirect("/assets?archived=1");
}

export async function saveServicePlan(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "fleet");
  const assetId = str(fd.get("asset_id"));
  const interval_meter = optNum(fd.get("interval_meter"));
  const interval_days = optNum(fd.get("interval_days"));
  const last_service_meter = optNum(fd.get("last_service_meter"));
  const last_service_date = optStr(fd.get("last_service_date"));
  let next_due_meter = optNum(fd.get("next_due_meter"));
  let next_due_date = optStr(fd.get("next_due_date"));
  const values = valuesOf(fd);

  if (interval_meter === null && interval_days === null) return { error: "Enter a KM/hours interval, a days interval, or both.", values };
  if (interval_days !== null && !Number.isInteger(interval_days)) return { error: "Days interval must be a whole number.", values };
  if (last_service_date && last_service_date > todayNairobi()) return { error: "Last service date can't be in the future.", values };

  if (next_due_meter === null && interval_meter !== null && last_service_meter !== null) next_due_meter = last_service_meter + interval_meter;
  if (!next_due_date && interval_days !== null && last_service_date) {
    const d = new Date(last_service_date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + interval_days);
    next_due_date = d.toISOString().slice(0, 10);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("service_plans").upsert({
    asset_id: assetId,
    interval_meter,
    interval_days,
    last_service_meter,
    last_service_date,
    next_due_meter,
    next_due_date,
    schedule_anchor: str(fd.get("schedule_anchor")) === "planned" ? "planned" : "actual",
    service_type_note: optStr(fd.get("service_type_note")),
    estimated_cost: optNum(fd.get("estimated_cost")),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: friendlyError(error), values };
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Service plan saved.", nonce: Date.now() };
}

const ALLOWED_FILES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** Uploads a file to the asset-files bucket and records it. Returns an error message, or null. */
async function storeFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
  assetId: string,
  opts: { title: string; kind: string; serviceRecordId?: string | null; breakdownId?: string | null },
): Promise<string | null> {
  if (!ALLOWED_FILES.includes(file.type)) return "File must be a PDF, JPG, PNG or WEBP.";
  if (file.size > 4 * 1024 * 1024) return "File is larger than 4 MB.";
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${assetId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("asset-files").upload(path, file, { contentType: file.type });
  if (upErr) return "Upload failed. " + friendlyError(upErr);
  const { error } = await supabase.from("asset_files").insert({
    asset_id: assetId,
    service_record_id: opts.serviceRecordId ?? null,
    breakdown_id: opts.breakdownId ?? null,
    title: opts.title.slice(0, 120),
    kind: opts.kind,
    file_path: path,
    file_size: file.size,
    mime_type: file.type,
  });
  return error ? friendlyError(error) : null;
}

export async function uploadAssetFile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "fleet", "stores");
  const assetId = str(fd.get("asset_id"));
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  const title = str(fd.get("title")) || file.name;

  const supabase = await createClient();
  const err = await storeFile(supabase, file, assetId, { title, kind: str(fd.get("kind")) || "other" });
  if (err) return { error: err };
  revalidatePath(`/assets/${assetId}`);
  return { ok: true, message: "File uploaded.", nonce: Date.now() };
}

export async function deleteAssetFile(fd: FormData) {
  await requireRole("admin");
  const id = str(fd.get("id"));
  const assetId = str(fd.get("asset_id"));
  const supabase = await createClient();
  const { data: file } = await supabase.from("asset_files").select("file_path").eq("id", id).maybeSingle();
  if (file?.file_path) await supabase.storage.from("asset-files").remove([file.file_path]);
  await supabase.from("asset_files").delete().eq("id", id);
  revalidatePath(`/assets/${assetId}`);
}

export async function recordReading(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "fleet");
  const assetId = str(fd.get("asset_id"));
  const reading = parseReading(fd.get("reading"));
  const values = valuesOf(fd);
  if (reading === null) return { error: "Enter the reading as a number, e.g. 33,117.", values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_meter_reading", {
    p_asset_id: assetId,
    p_reading: reading,
    p_confirmed: str(fd.get("confirmed")) === "1",
    p_note: optStr(fd.get("note")),
  });
  if (error) return { error: friendlyError(error), values };
  if (data?.status === "needs_confirmation") return { warning: data.warning, values: { ...values, needs_confirm: "1" } };

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets");
  revalidatePath("/dashboard");
  return { ok: true, message: "Reading saved.", nonce: Date.now() };
}

export async function completeService(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "fleet");
  const assetId = str(fd.get("asset_id"));
  const values = valuesOf(fd);
  const serviceDate = str(fd.get("service_date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) return { error: "Enter the service date.", values };
  const meter = optNum(fd.get("meter_at_service"));
  const cost = optNum(fd.get("cost"));
  if (str(fd.get("cost")) !== "" && cost === null) return { error: "Cost must be a number.", values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_service", {
    p_asset_id: assetId,
    p_service_date: serviceDate,
    p_meter: meter,
    p_service_type: optStr(fd.get("service_type")),
    p_performed_by: optStr(fd.get("performed_by")),
    p_cost: cost ?? 0,
    p_notes: optStr(fd.get("notes")),
    p_set_operational: true,
  });
  if (error) return { error: friendlyError(error), values };

  // optional invoice / job card for this service
  const file = fd.get("invoice");
  let fileNote = "";
  if (file instanceof File && file.size > 0) {
    const err = await storeFile(supabase, file, assetId, {
      title: `${str(fd.get("service_type")) || "Service"} — ${serviceDate}`,
      kind: "invoice",
      serviceRecordId: data?.record_id ?? null,
    });
    if (err) fileNote = ` (but the file was not saved: ${err})`;
  }

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets");
  revalidatePath("/dashboard");
  const next = [
    data?.next_due_meter != null ? `${Number(data.next_due_meter).toLocaleString("en-KE")}` : null,
    data?.next_due_date ? `date ${data.next_due_date}` : null,
  ].filter(Boolean).join(" / ");
  return { ok: true, message: `Service recorded.${next ? ` Next service: ${next}.` : ""}${fileNote}`, nonce: Date.now() };
}
