import Link from "next/link";
import { AlertOctagon, CheckCircle2, ClipboardList, FileCheck2, Truck, Wrench, Gauge } from "lucide-react";
import { requireUser, canEditFleet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadAttention, type Priority } from "@/lib/attention";
import { Card, CardHeader, EmptyState, PageHeader, StatCard, cn } from "@/components/ui";
import { ActionGroups, AllClear, P_STYLE, PriorityBar } from "@/components/dashboard/action-center";
import { formatDate, todayNairobi } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ show?: string; denied?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const supabase = await createClient();
  const { items, assets, docs } = await loadAttention(supabase);

  const active = assets.filter((a) => a.operational_status !== "disposed");
  const count = (p: Priority) => items.filter((i) => i.priority === p).length;
  const svc = (s: string) => active.filter((a) => a.service_status === s).length;
  const filter = ["critical", "important", "normal"].includes(sp.show ?? "") ? (sp.show as Priority) : "all";
  const shown = filter === "all" ? items : items.filter((i) => i.priority === filter);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Nairobi" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const critical = count("critical");

  return (
    <>
      {sp.denied && <p className="mb-4 animate-pop rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-600/20">You don&apos;t have access to that page.</p>}

      <PageHeader
        title={`${greeting}, ${user.fullName.split(" ")[0]}`}
        subtitle={<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{formatDate(todayNairobi())}</span>
          <span className="text-slate-300">·</span>
          {items.length === 0 ? <span className="font-medium text-emerald-600">Nothing needs attention</span> : (
            <>
              {(["critical", "important", "normal"] as Priority[]).filter((p) => count(p)).map((p) => (
                <span key={p} className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", P_STYLE[p].chip)}>{count(p)} {P_STYLE[p].label.toLowerCase()}</span>
              ))}
            </>
          )}
        </span>}
      />

      <div className="stagger mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Assets" value={active.length} icon={Truck} href="/assets" sub="in the register" />
        <StatCard label="Operational" value={active.filter((a) => a.operational_status === "operational").length} tone="green" icon={CheckCircle2} href="/assets?status=operational" />
        <StatCard label="Not working" value={active.filter((a) => ["under_maintenance", "breakdown"].includes(a.operational_status)).length} tone="amber" icon={Wrench} href="/assets?status=attention" sub="maintenance / breakdown" />
        <StatCard label="Overdue service" value={svc("overdue")} tone={svc("overdue") ? "red" : "slate"} icon={AlertOctagon} href="/assets?service=overdue" />
        <StatCard label="Due / due soon" value={svc("due") + svc("due_soon")} tone={svc("due") + svc("due_soon") ? "amber" : "slate"} icon={Gauge} href="/assets?service=due" />
        <StatCard label="Documents" value={`${docs.filter((d) => d.status === "expired").length} / ${docs.filter((d) => d.status === "expiring_soon").length}`} tone={docs.some((d) => d.status === "expired") ? "red" : docs.length ? "amber" : "slate"} icon={FileCheck2} href="/compliance" sub="expired / expiring" />
      </div>

      <Card className="animate-rise">
        <CardHeader
          title="Action Center"
          subtitle={items.length ? "Grouped by urgency — the number on the right is what to watch" : "Nothing needs attention right now"}
          icon={ClipboardList}
          right={
            <div className="flex flex-wrap gap-1 text-sm">
              {(["all", "critical", "important", "normal"] as const).map((f) => {
                const n = f === "all" ? items.length : count(f);
                const on = filter === f;
                if (f !== "all" && n === 0) return null;
                return (
                  <Link key={f} href={f === "all" ? "/dashboard" : `/dashboard?show=${f}`}
                    className={cn("rounded-full px-3 py-1 text-xs font-medium capitalize transition", on ? "bg-navy text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50")}>
                    {f} <span className="tabular">{n}</span>
                  </Link>
                );
              })}
            </div>
          }
        />
        {items.length > 0 && <div className="px-4 pt-3 sm:px-5"><PriorityBar items={items} /></div>}
        {shown.length === 0 ? (
          items.length === 0 ? <AllClear /> : (
            <EmptyState title="Nothing in this filter" icon={CheckCircle2}>
              <Link href="/dashboard" className="font-medium text-navy underline">Show everything</Link>
            </EmptyState>
          )
        ) : (
          <div className="mt-3"><ActionGroups items={shown} canAct={canEditFleet(user.role)} /></div>
        )}
      </Card>

      {critical > 0 && (
        <p className="mt-4 text-center text-xs text-slate-400">Critical items are also emailed every morning at 7:00.</p>
      )}
    </>
  );
}
