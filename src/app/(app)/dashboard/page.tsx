import Link from "next/link";
import { AlertOctagon, CheckCircle2, ClipboardList, FileCheck2, Gauge, Truck, Wrench } from "lucide-react";
import { requireUser, canEditFleet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadAttention, type ComplianceRow, type Priority } from "@/lib/attention";
import { buildAssetCards, criticalItems } from "@/lib/fleet-board";
import { PageHeader, StatCard, cn } from "@/components/ui";
import { CriticalStrip, FleetBoard, P_STYLE } from "@/components/dashboard/fleet-board";
import { FleetStatusPanel, Next30Panel, StoresPanel } from "@/components/dashboard/panels";
import { AssetSnapshot, type LastService, type SnapshotExtra } from "@/components/dashboard/asset-snapshot";
import { SnapshotShell } from "@/components/dashboard/snapshot-shell";
import { formatDate, todayNairobi } from "@/lib/format";

export const metadata = { title: "Dashboard" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string; asset?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const supabase = await createClient();

  const { items, assets, docs, allDocs, breakdowns } = await loadAttention(supabase);

  const cards = buildAssetCards(assets, allDocs, breakdowns);
  const critical = criticalItems(items);
  const stores = items.filter((i) => i.assetId === null);

  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Nairobi" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const active = assets.filter((a) => a.operational_status !== "disposed");
  const count = (p: Priority) => items.filter((i) => i.priority === p).length;
  const svc = (s: string) => active.filter((a) => a.service_status === s).length;

  // Vehicle snapshot (opened by clicking a row)
  const selectedId = sp.asset && UUID.test(sp.asset) ? sp.asset : null;
  const selected = selectedId ? assets.find((a) => a.id === selectedId) ?? null : null;
  let snapshot: React.ReactNode = null;
  if (selected) {
    const [{ data: extra }, { data: last }] = await Promise.all([
      supabase.from("assets").select("driver_name, co_driver_name, make, model").eq("id", selected.id).maybeSingle(),
      supabase.from("service_records").select("service_date, service_type, performed_by, cost")
        .eq("asset_id", selected.id).order("service_date", { ascending: false }).limit(1).maybeSingle(),
    ]);
    snapshot = (
      <SnapshotShell closeHref="/dashboard" title={selected.name}>
        <AssetSnapshot
          row={selected}
          extra={(extra ?? { driver_name: null, co_driver_name: null, make: null, model: null }) as SnapshotExtra}
          docs={allDocs.filter((d) => d.asset_id === selected.id) as ComplianceRow[]}
          breakdowns={breakdowns.filter((b) => b.asset_id === selected.id)}
          items={items.filter((i) => i.assetId === selected.id)}
          lastService={(last ?? null) as LastService}
          canEdit={canEditFleet(user.role)}
        />
      </SnapshotShell>
    );
  }

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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <CriticalStrip items={critical} canAct={canEditFleet(user.role)} />

          <div className="mb-2.5 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">Action Center</h2>
            <span className="text-xs text-slate-400">every asset · worst first</span>
            <Link href="/assets" className="ml-auto text-xs font-medium text-navy hover:underline">Full register</Link>
          </div>

          <FleetBoard cards={cards} selectedId={selectedId} />
        </div>

        <aside className="space-y-4">
          <FleetStatusPanel cards={cards} />
          <Next30Panel assets={assets} allDocs={allDocs} />
          <StoresPanel items={stores} />
        </aside>
      </div>

      <p className="mt-5 text-center text-xs text-slate-400">
        Tap any asset for its snapshot.{critical.length > 0 ? " Critical items are emailed every morning at 7:00." : ""}
      </p>

      {snapshot}
    </>
  );
}
