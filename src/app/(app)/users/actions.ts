"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError, type ActionState } from "@/lib/errors";

const newUser = z.object({
  full_name: z.string().min(2, "Enter the full name"),
  email: z.string().email("Enter a valid email"),
  role: z.enum(["admin", "fleet", "stores", "management"]),
  password: z.string().min(10, "Temporary password must be at least 10 characters"),
});

export async function addUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("admin");
  const values = { full_name: String(fd.get("full_name") ?? ""), email: String(fd.get("email") ?? ""), role: String(fd.get("role") ?? "") };
  const parsed = newUser.safeParse({ ...values, password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: { role: parsed.data.role, full_name: parsed.data.full_name.trim() },
  });
  if (error) return { error: error.message.includes("already") ? "A user with this email already exists." : error.message, values };

  // make sure profile matches (trigger creates it; this also covers re-runs)
  await admin.from("profiles").upsert({
    id: data.user.id, email: parsed.data.email.trim().toLowerCase(), full_name: parsed.data.full_name.trim(), role: parsed.data.role, is_active: true,
  });
  revalidatePath("/users");
  return { ok: true, message: `User created. Give ${parsed.data.full_name} their email and temporary password; they can change it under "My account".`, nonce: Date.now() };
}

export async function updateUser(fd: FormData) {
  await requireRole("admin");
  const id = String(fd.get("id"));
  const role = String(fd.get("role"));
  const is_active = String(fd.get("is_active")) === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role, is_active }).eq("id", id);
  if (error) console.error(friendlyError(error));
  revalidatePath("/users");
}
