"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { friendlyError, type ActionState } from "@/lib/errors";
import { parseReading } from "@/lib/format";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export async function saveDocument(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin", "fleet");
  const s = (k: string) => (typeof fd.get(k) === "string" ? String(fd.get(k)).trim() : "");
  const values = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

  const document_type = s("document_type");
  const expiry_date = s("expiry_date");
  const issue_date = s("issue_date") || null;
  if (!document_type) return { error: "Choose a document type.", values };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) return { error: "Enter the expiry date.", values };
  if (issue_date && issue_date > expiry_date) return { error: "Expiry date must be after the issue date.", values };
  const cost = s("cost") ? parseReading(s("cost")) : null;
  if (s("cost") && cost === null) return { error: "Cost must be a number.", values };

  const supabase = await createClient();

  let file_path: string | null = null;
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED.includes(file.type)) return { error: "File must be a PDF, JPG, PNG or WEBP.", values };
    if (file.size > 4 * 1024 * 1024) return { error: "File is larger than 4 MB. Take a smaller photo or compress the PDF.", values };
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    file_path = `${s("asset_id") || "company"}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("compliance-docs").upload(file_path, file, { contentType: file.type });
    if (upErr) return { error: "File upload failed. " + friendlyError(upErr), values };
  }

  const renewId = s("renew_id");
  const { error } = await supabase.from("compliance_documents").insert({
    asset_id: s("asset_id") || null,
    document_type,
    document_number: s("document_number") || null,
    issuer: s("issuer") || null,
    issue_date,
    expiry_date,
    cost,
    file_path,
    notes: s("notes") || null,
  });
  if (error) return { error: friendlyError(error), values };

  if (renewId) {
    await supabase.from("compliance_documents").update({ is_current: false, updated_at: new Date().toISOString() }).eq("id", renewId);
  }
  revalidatePath("/compliance");
  revalidatePath("/dashboard");
  if (s("asset_id")) revalidatePath(`/assets/${s("asset_id")}`);
  redirect(`/compliance?saved=1`);
}

export async function retireDocument(fd: FormData) {
  await requireRole("admin", "fleet");
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("compliance_documents").update({ is_current: false, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/compliance");
  revalidatePath("/dashboard");
}
