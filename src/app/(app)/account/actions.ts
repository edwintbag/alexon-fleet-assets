"use server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/errors";

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const pw = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (pw.length < 10) return { error: "Use at least 10 characters." };
  if (pw !== confirm) return { error: "The passwords don't match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: error.message };
  return { ok: true, message: "Password changed.", nonce: Date.now() };
}
