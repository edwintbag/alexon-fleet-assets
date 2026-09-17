import Link from "next/link";
import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { requireUser, canEditFleet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadAttention, type AttentionItem, type Priority } from "@/lib/attention";
import { Card, CardHeader, EmptyState, PageHeader, Stat, cn } from "@/components/ui";
import { formatDate, todayNairobi } from "@/lib/format";

export const metadata = { title: "Dashboard" };

const PRIORITY_STYLE: Record<Priority, { label: string; icon: typeof Info; cls: string }> = {
  critical: { label: "Critical", icon: AlertOctagon, cls: "text-red-600" },
  important: { label: "Important", icon: AlertTriangle, cls: "text-amber-600" },
  normal: { label: "Normal", icon: Info, cls: "text-sky-600" },
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ show?: string; denied?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const supabase = await createClient();
  const { items, assets, docs } = await loadAttention(supabase);

  const active = assets.filter((a) => a.operational_status !== "disposed");
  const count = (p: Priority) => items.filter((i) => i.priority === p).length;
  const svc = (s: string) => active.filter((a) => a.service_status === s).length;
  const filter = sp.show === "critical" || sp.show === "important" || sp.show === "normal" ? sp.show : "all";
  const shown = filter === "all" ? items : items.filter((i) => i.priority === filter);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Nairobi" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      {sp.denied && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">You don&apos;t have access to that page.</p>}
      <PageHeader
        title={`${greeting}, ${user.fullName.split(" ")[0]}`}
        subtitle={`${formatDate(todayNairobi())} · ${items.length === 0 ? "Nothing needs attention" : `${count("critical")} critical · ${count("important")} important · ${count("normal")} normal`}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Assets" value={active.length} href="/assets" />
        <Stat label="Operational" value={active.filter((a) => a.operational_status === "operational").length} href="/assets?status=operational" />
        <Stat label="Maintenance / breakdown" value={active.filter((a) => a.operational_status === "under_maintenance" || a.operational_status === "breakdown").length} tone="amber" href="/assets?status=attention" />
        <Stat label="Overdue services" value={svc("overdue")} tone={svc("overdue") ? "red" : undefined} href="/assets?service=overdue" />
        <Stat label="Due / due soon" value={svc("due") + svc("due_soon")} tone={svc("due") + svc("due_soon") ? "amber" : undefined} href="/assets?service=due" />
        <Stat label="Docs expired / expiring" value={`${docs.filter((d) => d.status === "expired").length} / ${docs.filter((d) => d.status === "expiring_soon").length}`} tone={docs.some((d) => d.status === "expired") ? "red" : undefined} href="/compliance" />
      </div>

      <Card>
        <CardHeader
          title="Action Center"
          subtitle="What needs attention, most urgent first"
          right={
            <div className="flex flex-wrap gap-1 text-sm">
              {(["all", "critical", "important", "normal"] as const).map((f) => (
                <Link
                  key={f}
                  href={f === "all" ? "/dashboard" : `/dashboard?show=${f}`}
                  className={cn("rounded-full px-3 py-1 capitalize", filter === f ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                >
                  {f} {f === "all" ? items.length : count(f)}
                </Link>
              ))}
            </div>
          }
        />
        {shown.length === 0 ? (
          <EmptyState title="All clear">
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Nothing in this list needs attention right now.</span>
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((item) => (
              <AttentionRow key={item.key} item={item} canAct={canEditFleet(user.role)} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function AttentionRow({ item, canAct }: { item: AttentionItem; canAct: boolean }) {
  const P = PRIORITY_STYLE[item.priority];
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <P.icon className={cn("hidden h-5 w-5 shrink-0 sm:block", P.cls)} aria-label={P.label} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className={cn("font-semibold", P.cls)}>{item.headline}</span>
          <span className="text-slate-400"> · </span>
          {item.assetId ? (
            <Link href={`/assets/${item.assetId}`} className="font-medium text-slate-900 hover:underline">{item.assetName}</Link>
          ) : (
            <span className="font-medium text-slate-900">{item.assetName}</span>
          )}
          {item.reg !== "—" && <span className="text-slate-500"> ({item.reg})</span>}
        </p>
        <p className="text-sm text-slate-600">{item.detail}</p>
      </div>
      {item.action && canAct && (
        <Link href={item.action.href} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:shrink-0">
          {item.action.label}
        </Link>
      )}
    </li>
  );
}
