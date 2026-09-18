import Link from "next/link";
import { Boxes, ChevronRight, Package, Plus, Search, Truck } from "lucide-react";
import { requireUser, canManageStock } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PartRow } from "@/lib/attention";
import { Badge, Card, EmptyState, LinkButton, PageHeader, StatCard, buttonClass, cn, inputClass } from "@/components/ui";
import { AutoSubmit } from "@/components/form-bits";
import { STOCK_STATUS } from "@/lib/status";
import { formatKES, formatNumber } from "@/lib/format";

export const metadata = { title: "Spare parts" };

export default async function PartsPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string; category?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("v_part_stock_status").select("*").order("name");
  const all = (data ?? []) as PartRow[];
  const categories = [...new Set(all.map((p) => p.category).filter(Boolean))].sort() as string[];

  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = all
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.part_number ?? "").toLowerCase().includes(q))
    .filter((p) => !sp.category || p.category === sp.category)
    .filter((p) => (sp.show === "attention" ? p.stock_status !== "ok" : true))
    .sort((a, b) => (a.stock_status === b.stock_status ? a.name.localeCompare(b.name) : a.stock_status === "out_of_stock" ? -1 : b.stock_status === "out_of_stock" ? 1 : a.stock_status === "low" ? -1 : 1));

  const value = all.reduce((sum, p) => sum + Number(p.current_stock) * Number(p.average_cost), 0);
  const manage = canManageStock(user.role);

  return (
    <>
      <PageHeader
        title="Spare parts"
        subtitle={`${all.length} parts · stock value ${formatKES(value)}`}
        actions={manage ? <LinkButton href="/parts/new" variant="primary"><Plus className="h-4 w-4" /> Add part</LinkButton> : undefined}
      />

      <div className="stagger mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Parts" value={all.length} icon={Package} />
        <StatCard label="Out of stock" value={all.filter((p) => p.stock_status === "out_of_stock").length} tone={all.some((p) => p.stock_status === "out_of_stock") ? "red" : "slate"} icon={Boxes} href="/parts?show=attention" />
        <StatCard label="Low stock" value={all.filter((p) => p.stock_status === "low").length} tone={all.some((p) => p.stock_status === "low") ? "amber" : "slate"} icon={Boxes} href="/parts?show=attention" />
        <StatCard label="On order" value={all.filter((p) => p.on_order > 0).length} tone="blue" icon={Truck} href="/purchasing" />
      </div>

      <AutoSubmit className="mb-4 grid gap-2 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search part or number" className={cn(inputClass, "pl-9")} />
        </div>
        <select name="show" defaultValue={sp.show ?? ""} className={inputClass} aria-label="Stock filter">
          <option value="">All parts</option>
          <option value="attention">Low or out of stock</option>
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
          <EmptyState title={all.length === 0 ? "No parts yet" : "Nothing matches"} icon={Package}>
            {all.length === 0 && manage ? <Link href="/parts/new" className="font-medium text-navy underline">Add your first part</Link> : <Link href="/parts" className="font-medium text-navy underline">Clear filters</Link>}
          </EmptyState>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Part</th>
                    <th className="px-4 py-3 font-semibold">In stock</th>
                    <th className="px-4 py-3 font-semibold">Minimum</th>
                    <th className="px-4 py-3 font-semibold">On order</th>
                    <th className="px-4 py-3 font-semibold">Avg cost</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((p) => {
                    const st = STOCK_STATUS[p.stock_status];
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <Link href={`/parts/${p.id}`} className="font-medium text-slate-900 underline-offset-2 hover:underline">{p.name}</Link>
                          <div className="text-xs text-slate-500">{[p.part_number, p.category].filter(Boolean).join(" · ") || "—"}</div>
                        </td>
                        <td className="px-4 py-3 font-medium tabular">{formatNumber(p.current_stock, 2)} {p.unit}</td>
                        <td className="px-4 py-3 tabular text-slate-500">{formatNumber(p.minimum_stock, 2)}</td>
                        <td className="px-4 py-3 tabular text-slate-500">{p.on_order > 0 ? formatNumber(p.on_order, 2) : "—"}</td>
                        <td className="px-4 py-3 tabular text-slate-600">{formatKES(p.average_cost)}</td>
                        <td className="px-4 py-3 text-slate-500">{p.location ?? "—"}</td>
                        <td className="px-4 py-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((p) => {
                const st = STOCK_STATUS[p.stock_status];
                return (
                  <li key={p.id}>
                    <Link href={`/parts/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-medium text-slate-900">{p.name}</p>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </div>
                        <p className="mt-0.5 text-sm tabular text-slate-600">
                          {formatNumber(p.current_stock, 2)} {p.unit} <span className="text-slate-400">· min {formatNumber(p.minimum_stock, 2)}</span>
                          {p.on_order > 0 && <span className="text-sky-600"> · {formatNumber(p.on_order, 2)} on order</span>}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
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
