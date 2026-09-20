import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireUser, ROLE_LABELS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { signOut } from "@/app/login/actions";
import wordmarkCompact from "@/assets/brand/wordmark-compact.png";
import emblem from "@/assets/brand/emblem.png";

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
        <Link href="/dashboard" className="mb-7 block px-3 pt-1" aria-label="Alexon Group Ltd — dashboard">
          <Image src={wordmarkCompact} alt="Alexon Group Ltd" priority className="h-auto w-[176px] drop-shadow-[0_4px_10px_rgba(0,0,0,.35)]" />
          <span className="mt-2 block whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white/75">Fleet &amp; Asset Management</span>
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
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="Alexon Group Ltd — dashboard">
            <Image src={emblem} alt="Alexon Group Ltd" priority className="h-11 w-auto" />
            <span className="border-l border-slate-200 pl-2.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-slate-600">Fleet &amp;<br />Assets</span>
          </Link>
          <Link href="/account" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{initials}</Link>
        </header>

        <main className="pb-safe mx-auto max-w-6xl px-4 pt-5 sm:px-6 md:pb-12 md:pt-8">{children}</main>
        <Nav isAdmin={user.role === "admin"} variant="bottom" counts={counts} />
      </div>
    </div>
  );
}
