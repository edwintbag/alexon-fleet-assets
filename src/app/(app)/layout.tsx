import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireUser, ROLE_LABELS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { signOut } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // small badge counts for the navigation
  const supabase = await createClient();
  const safe = async <T,>(fn: () => PromiseLike<{ data: T[] | null }>) => {
    try { return (await fn()).data ?? []; } catch { return [] as T[]; }
  };
  const [svc, docs, faults, lowParts, prs, plansDue] = await Promise.all([
    safe(() => supabase.from("v_asset_service_status").select("service_status").is("archived_at", null)),
    safe(() => supabase.from("v_compliance_status").select("status").neq("status", "valid")),
    safe(() => supabase.from("v_breakdowns").select("status").neq("status", "resolved")),
    safe(() => supabase.from("v_part_stock_status").select("stock_status").neq("stock_status", "ok")),
    safe(() => supabase.from("v_purchase_requests").select("status").eq("status", "submitted")),
    safe(() => supabase.from("v_purchase_plans").select("id").eq("is_active", true).lte("days_until_due", 0)),
  ]);
  const counts = {
    "/assets": svc.filter((r) => ["overdue", "due", "due_soon"].includes(String((r as { service_status: string }).service_status))).length,
    "/compliance": docs.length,
    "/breakdowns": faults.length,
    "/parts": lowParts.length,
    "/purchasing": prs.length + plansDue.length,
  };
  const initials = user.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-navy via-navy to-navy-900 px-3 py-5 md:flex">
        <Link href="/dashboard" className="mb-7 flex items-center gap-2.5 px-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base font-bold text-white shadow-lg shadow-brand/20">A</span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold text-white">Alexon Fleet</span>
            <span className="block text-[11px] text-white/50">Asset Management</span>
          </span>
        </Link>

        <Nav isAdmin={user.role === "admin"} variant="side" counts={counts} />

        <div className="mt-auto rounded-xl bg-white/5 p-3">
          <Link href="/account" className="flex items-center gap-2.5 rounded-lg transition hover:opacity-90">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">{initials}</span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-medium text-white">{user.fullName}</span>
              <span className="block truncate text-[11px] text-white/50">{ROLE_LABELS[user.role]}</span>
            </span>
          </Link>
          <form action={signOut} className="mt-2">
            <button className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/5 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white">A</span>
            <span className="text-[15px] font-semibold tracking-tight">Alexon Fleet</span>
          </Link>
          <Link href="/account" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{initials}</Link>
        </header>

        <main className="pb-safe mx-auto max-w-6xl px-4 pt-5 sm:px-6 md:pb-12 md:pt-8">{children}</main>
        <Nav isAdmin={user.role === "admin"} variant="bottom" counts={counts} />
      </div>
    </div>
  );
}
