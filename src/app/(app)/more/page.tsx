import Link from "next/link";
import { ChevronRight, LogOut, User } from "lucide-react";
import { requireUser, ROLE_LABELS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { NAV_ITEMS } from "@/components/nav";
import { signOut } from "@/app/login/actions";

export const metadata = { title: "More" };

export default async function MorePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: parts }, { data: prs }, { data: plansDue }] = await Promise.all([
    supabase.from("v_part_stock_status").select("stock_status").neq("stock_status", "ok"),
    supabase.from("v_purchase_requests").select("status").eq("status", "submitted"),
    supabase.from("v_purchase_plans").select("id").eq("is_active", true).lte("days_until_due", 0),
  ]);
  const counts: Record<string, number> = {
    "/parts": parts?.length ?? 0,
    "/purchasing": (prs?.length ?? 0) + (plansDue?.length ?? 0),
  };
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || user.role === "admin");

  return (
    <>
      <PageHeader title="More" subtitle={`${user.fullName} · ${ROLE_LABELS[user.role]}`} />
      <Card className="animate-rise">
        <ul className="divide-y divide-slate-100">
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50">
                <i.icon className="h-5 w-5 text-slate-400" />
                <span className="flex-1 font-medium text-slate-800">{i.label}</span>
                {counts[i.href] ? <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white tabular">{counts[i.href]}</span> : null}
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </Link>
            </li>
          ))}
          <li>
            <Link href="/account" className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50">
              <User className="h-5 w-5 text-slate-400" />
              <span className="flex-1 font-medium text-slate-800">My account</span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </Link>
          </li>
        </ul>
      </Card>
      <form action={signOut} className="mt-5">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 active:scale-[.99]">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </form>
    </>
  );
}
