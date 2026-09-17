import Link from "next/link";
import { Plus, Download, Search } from "lucide-react";
import { requireUser, canEditFleet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssetStatusRow } from "@/lib/attention";
import { Badge, Card, EmptyState, LinkButton, PageHeader, inputClass } from "@/components/ui";
import { SERVICE_STATUS, OPERATIONAL_STATUS } from "@/lib/status";
import { daysAgo, formatMeter, formatNumber, formatReg, unitFor } from "@/lib/format";

export const metadata = { title: "Fleet & Machinery" };

type SP = { q?: string; service?: string; status?: string; category?: string; archived?: string };

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
    .sort((x, y) => SERVICE_STATUS[y.service_status].rank - SERVICE_STATUS[x.service_status].rank || x.name.localeCompare(y.name));

  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      {sp.archived && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Asset archived.</p>}
      <PageHeader
        title="Fleet & Machinery"
        subtitle={`${rows.length} of ${all.length} assets`}
        actions={
          <>
            <a href={`/api/export/assets${exportQs ? `?${exportQs}` : ""}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" /> Export CSV
            </a>
            {canEditFleet(user.role) && <LinkButton href="/assets/new" variant="primary"><Plus className="h-4 w-4" /> Add asset</LinkButton>}
          </>
        }
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name or registration" className={`${inputClass} pl-9`} />
        </div>
        <select name="service" defaultValue={sp.service ?? ""} className={inputClass}>
          <option value="">All service statuses</option>
          <option value="attention">Overdue / due / due soon</option>
          <option value="overdue">Overdue</option>
          <option value="due">Due / due soon</option>
          <option value="approaching">Approaching</option>
          <option value="normal">OK</option>
          <option value="no_data">Needs setup</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={inputClass}>
          <option value="">All operational statuses</option>
          {Object.entries(OPERATIONAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select name="category" defaultValue={sp.category ?? ""} className={inputClass}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="min-h-10 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700">Filter</button>
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No assets match">
            <Link href="/assets" className="underline">Clear filters</Link>
          </EmptyState>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Current reading</th>
                    <th className="px-4 py-3">Next service</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((a) => {
                    const s = SERVICE_STATUS[a.service_status];
                    const o = OPERATIONAL_STATUS[a.operational_status];
                    return (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link href={`/assets/${a.id}`} className="font-medium text-slate-900 hover:underline">{a.name}</Link>
                          <div className="text-xs text-slate-500">{formatReg(a.registration_number)}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{a.category || "—"}</td>
                        <td className="px-4 py-3 tabular">
                          {a.meter_type === "none" ? <span className="text-slate-400">No meter</span> : formatMeter(a.current_reading, a.meter_type)}
                          {a.meter_type !== "none" && a.current_reading !== null && (
                            <div className={`text-xs ${a.reading_stale ? "text-amber-600" : "text-slate-500"}`}>{daysAgo(a.reading_age_days)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular text-slate-600">
                          {a.next_due_meter !== null ? formatMeter(a.next_due_meter, a.meter_type) : a.next_due_date ?? "—"}
                          {a.remaining_meter !== null && (
                            <div className="text-xs text-slate-500">
                              {a.remaining_meter < 0 ? `${formatNumber(-a.remaining_meter)} ${unitFor(a.meter_type)} over` : `${formatNumber(a.remaining_meter)} ${unitFor(a.meter_type)} left`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3"><Badge tone={s.tone}>{s.label}</Badge></td>
                        <td className="px-4 py-3"><Badge tone={o.tone}>{o.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((a) => {
                const s = SERVICE_STATUS[a.service_status];
                return (
                  <li key={a.id}>
                    <Link href={`/assets/${a.id}`} className="block px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{a.name}</p>
                          <p className="text-xs text-slate-500">{formatReg(a.registration_number)} · {a.category || "—"}</p>
                        </div>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </div>
                      {a.meter_type !== "none" && (
                        <p className="mt-1 text-sm tabular text-slate-600">
                          {formatMeter(a.current_reading, a.meter_type)}
                          {a.remaining_meter !== null && ` · ${a.remaining_meter < 0 ? "over by " + formatNumber(-a.remaining_meter) : formatNumber(a.remaining_meter) + " left"}`}
                          <span className={a.reading_stale ? " text-amber-600" : " text-slate-400"}> · {daysAgo(a.reading_age_days)}</span>
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
