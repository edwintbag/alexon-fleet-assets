import Link from "next/link";
import { Download, Plus, Search, Truck, ChevronRight } from "lucide-react";
import { requireUser, canEditFleet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CLASS_LABEL, classRank, loadAttention, type AssetStatusRow, type ComplianceRow } from "@/lib/attention";
import { Badge, Card, EmptyState, LinkButton, PageHeader, buttonClass, cn, inputClass } from "@/components/ui";
import { AutoSubmit } from "@/components/form-bits";
import { ClickableRow } from "@/components/clickable-row";
import { AssetSnapshot, type LastService, type SnapshotExtra } from "@/components/dashboard/asset-snapshot";
import { SnapshotShell } from "@/components/dashboard/snapshot-shell";
import { SERVICE_STATUS, OPERATIONAL_STATUS } from "@/lib/status";
import { daysAgo, formatMeter, formatNumber, formatReg, unitFor } from "@/lib/format";

export const metadata = { title: "Fleet & Machinery" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SP = { q?: string; service?: string; status?: string; category?: string; archived?: string; asset?: string };

export default async function AssetsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_asset_service_status").select("*").is("archived_at", null).order("name");
  if (error) throw error;
  const all = (data ?? []) as AssetStatusRow[];
  const categories = [...new Set(all.map((a) => a.category).filter(Boolean))].sort();

  const q = (sp.q ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const rows = all
    .filter((a) => !q || a.name.toLowerCase().replace(/\s+/g, "").includes(q) || (a.registration_number ?? "").toLowerCase().includes(q))
    .filter((a) => !sp.category || a.category === sp.category)
    .filter((a) =>
      !sp.service ? true
      : sp.service === "due" ? ["due", "due_soon"].includes(a.service_status)
      : sp.service === "attention" ? ["overdue", "due", "due_soon"].includes(a.service_status)
      : a.service_status === sp.service)
    .filter((a) =>
      !sp.status ? true
      : sp.status === "attention" ? ["under_maintenance", "breakdown"].includes(a.operational_status)
      : a.operational_status === sp.status)
    .sort((x, y) =>
      classRank(x.asset_class) - classRank(y.asset_class) ||
      SERVICE_STATUS[y.service_status].rank - SERVICE_STATUS[x.service_status].rank ||
      x.name.localeCompare(y.name));

  const groups = rows.reduce<{ label: string; rows: AssetStatusRow[] }[]>((acc, a) => {
    const label = CLASS_LABEL[a.asset_class] ?? "Other";
    const last = acc[acc.length - 1];
    if (last && last.label === label) last.rows.push(a);
    else acc.push({ label, rows: [a] });
    return acc;
  }, []);

  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v && v !== sp.asset) as [string, string][]).toString();
  const filtered = rows.length !== all.length;

  // Keep the current filters when a row opens or closes its snapshot
  const keep = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "asset" && k !== "archived") as [string, string][]).toString();
  const base = keep ? `/assets?${keep}` : "/assets";
  const rowHref = (id: string) => `${base}${keep ? "&" : "?"}asset=${id}`;

  // Snapshot panel — same one as the dashboard
  const selectedId = sp.asset && UUID.test(sp.asset) ? sp.asset : null;
  const selected = selectedId ? all.find((a) => a.id === selectedId) ?? null : null;
  let snapshot: React.ReactNode = null;
  if (selected) {
    const [{ items, allDocs, breakdowns }, { data: extra }, { data: last }] = await Promise.all([
      loadAttention(supabase),
      supabase.from("assets").select("driver_name, co_driver_name, make, model").eq("id", selected.id).maybeSingle(),
      supabase.from("service_records").select("service_date, service_type, performed_by, cost")
        .eq("asset_id", selected.id).order("service_date", { ascending: false }).limit(1).maybeSingle(),
    ]);
    snapshot = (
      <SnapshotShell closeHref={base} title={selected.name}>
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
      {sp.archived && <p className="mb-4 animate-pop rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/15">Asset archived.</p>}
      <PageHeader
        title="Fleet & Machinery"
        subtitle={filtered ? `${rows.length} of ${all.length} assets` : `${all.length} assets`}
        actions={
          <>
            <a href={`/api/export/assets${exportQs ? `?${exportQs}` : ""}`} className={buttonClass.secondary}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span> CSV
            </a>
            {canEditFleet(user.role) && <LinkButton href="/assets/new" variant="primary"><Plus className="h-4 w-4" /> Add asset</LinkButton>}
          </>
        }
      />

      <AutoSubmit className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name or registration" className={cn(inputClass, "pl-9")} />
        </div>
        <select name="service" defaultValue={sp.service ?? ""} className={inputClass} aria-label="Service status">
          <option value="">All service statuses</option>
          <option value="attention">Needs attention</option>
          <option value="overdue">Overdue</option>
          <option value="due">Due / due soon</option>
          <option value="approaching">Approaching</option>
          <option value="normal">OK</option>
          <option value="no_data">Needs setup</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={inputClass} aria-label="Operational status">
          <option value="">All operational statuses</option>
          {Object.entries(OPERATIONAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="category" defaultValue={sp.category ?? ""} className={inputClass} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className={cn(buttonClass.secondary, "shrink-0")}>Search</button>
        </div>
      </AutoSubmit>

      <Card className="animate-rise">
        {rows.length === 0 ? (
          <EmptyState title="No assets match" icon={Truck}>
            <Link href="/assets" className="font-medium text-navy underline">Clear filters</Link>
          </EmptyState>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Asset</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Current reading</th>
                    <th className="px-4 py-3 font-semibold">Next service</th>
                    <th className="px-4 py-3 font-semibold">Service</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.label} className="divide-y divide-slate-100">
                    {groups.length > 1 && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={6} className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {g.label} <span className="tabular text-slate-400">({g.rows.length})</span>
                        </td>
                      </tr>
                    )}
                    {g.rows.map((a) => {
                    const s = SERVICE_STATUS[a.service_status];
                    const o = OPERATIONAL_STATUS[a.operational_status];
                    return (
                      <ClickableRow key={a.id} href={rowHref(a.id)} selected={a.id === selectedId}>
                        <td className="px-5 py-3">
                          <Link href={`/assets/${a.id}`} className="font-medium text-slate-900 underline-offset-2 hover:underline">{a.name}</Link>
                          <div className="text-xs text-slate-500">{formatReg(a.registration_number)}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{a.category || "—"}</td>
                        <td className="px-4 py-3 tabular">
                          {a.meter_type === "none" ? <span className="text-slate-400">No meter</span> : formatMeter(a.current_reading, a.meter_type)}
                          {a.meter_type !== "none" && a.current_reading !== null && (
                            <div className={cn("text-xs", a.reading_stale ? "font-medium text-amber-600" : "text-slate-500")}>{a.reading_at ? daysAgo(a.reading_age_days) : "date unknown"}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular text-slate-600">
                          {a.next_due_meter !== null ? formatMeter(a.next_due_meter, a.meter_type) : a.next_due_date ?? "—"}
                          {a.remaining_meter !== null && (
                            <div className={cn("text-xs", a.remaining_meter < 0 ? "font-medium text-red-600" : "text-slate-500")}>
                              {a.remaining_meter < 0 ? `${formatNumber(-a.remaining_meter)} ${unitFor(a.meter_type)} over` : `${formatNumber(a.remaining_meter)} ${unitFor(a.meter_type)} left`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3"><Badge tone={s.tone}>{s.label}</Badge></td>
                        <td className="px-4 py-3"><Badge tone={o.tone} icon={false}>{o.label}</Badge></td>
                      </ClickableRow>
                    );
                    })}
                  </tbody>
                ))}
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {groups.map((g) => (
                <li key={g.label}>
                  {groups.length > 1 && (
                    <p className="bg-slate-50/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {g.label} <span className="tabular text-slate-400">({g.rows.length})</span>
                    </p>
                  )}
                  <ul className="divide-y divide-slate-100">
                    {g.rows.map((a) => {
                      const s = SERVICE_STATUS[a.service_status];
                      return (
                        <li key={a.id}>
                          <Link href={rowHref(a.id)} scroll={false} className="flex items-center gap-3 px-4 py-3.5 transition active:bg-slate-50">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate font-medium text-slate-900">{a.name}</p>
                                <Badge tone={s.tone}>{s.label}</Badge>
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">{formatReg(a.registration_number)} · {a.category || "—"}</p>
                              {a.meter_type !== "none" && (
                                <p className="mt-1 text-sm tabular text-slate-600">
                                  {formatMeter(a.current_reading, a.meter_type)}
                                  {a.remaining_meter !== null && <span className={a.remaining_meter < 0 ? "text-red-600" : ""}> · {a.remaining_meter < 0 ? `over by ${formatNumber(-a.remaining_meter)}` : `${formatNumber(a.remaining_meter)} left`}</span>}
                                  <span className={cn(" ·", a.reading_stale ? "text-amber-600" : "text-slate-400")}> {a.reading_at ? daysAgo(a.reading_age_days) : "date unknown"}</span>
                                </p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {snapshot}
    </>
  );
}
