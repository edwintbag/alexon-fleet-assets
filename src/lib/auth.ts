import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "fleet" | "stores" | "management";

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  fleet: "Fleet / Logistics",
  stores: "Stores / Procurement",
  management: "Management",
};

/** Verified current user (validated with Supabase Auth), cached per request. */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name || profile.email,
    role: profile.role as Role,
    isActive: profile.is_active,
  };
});

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isActive) redirect("/login?reason=inactive");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<AppUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}

export const canEditFleet = (role: Role) => role === "admin" || role === "fleet";
export const isAdmin = (role: Role) => role === "admin";
export const canManageStock = (role: Role) => role === "admin" || role === "stores";
export const canRequestPurchase = (role: Role) => role === "admin" || role === "stores" || role === "fleet";
export const canApprovePurchase = (role: Role) => role === "admin" || role === "management";
