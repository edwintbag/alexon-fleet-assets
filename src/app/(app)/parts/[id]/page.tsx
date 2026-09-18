import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, Package, Settings2 } from "lucide-react";
import { requireUser, canManageStock, canEditFleet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PartRow } from "@/lib/attention";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, ProgressMeter, cn } from "@/components/ui";
import { STOCK_STATUS } from "@/lib/status";
import { formatDateTime, formatKES, formatNumber } from "@/lib/format";
import { MovementForm } from "@/components/parts/movement-form";
import { PartForm } from "@/components/parts/part-form";

const MOVEMENT_LABEL: Record<string, string> = {
  opening_balance: "Opening balance", purchase_receipt: "Received", service_issue: "Used in service",
  breakdown_issue: "Used in repair", adjustment_in: "Adjustment (added)", adjustment_out: "Adjustment (removed)",
  return_to_stock: "Returned to stock", write_off: "Written off",
};

export default async function PartPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data }, { data: movements }, { data: suppliers }, { data: assets }] = await Promise.all([
    supabase.from("v_part_stock_status").select("*").eq("id", id).maybeSingle(),
    supabase.from("part_stock_movements").select("id, movement_type, quantity, balance_after, unit_cost, reference, reason, created_at, asset:assets(name), person:profiles!part_stock_movements_created_by_fkey(full_name)").eq("spare_part_id", id).order("created_at", { ascending: false }).limit(30),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("assets").select("id, name").is("archived_at", null).order("name"),
  ]);
  if (!data) notFound();
  const p = data as PartRow;
  const st = STOCK_STATUS[p.stock_status];
  const manage = canManageStock(user.role);
  const canMove = manage || canEditFleet(user.role);
  const target = Math.max(Number(p.minimum_stock) * 2, Number(p.current_stock), 1);

  return (
    <>
      {sp.created && <p className="mb-4 animate-pop rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/15">Part added.</p>}
      <nav className="mb-3 text-sm text-slate-500"><Link href="/parts" className="hover:text-navy hover:underline">Spare parts</Link> <span className="text-slate-300">/</span> <span className="text-slate-700">{p.name}</span></nav>

      <PageHeader
        title={p.name}
        subtitle={<span className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone} size="md">{st.label}</Badge>
          <span className="text-sm text-slate-500">{[p.part_number, p.category, p.location].filter(Boolean).join(" · ") || "No part number"}</span>
        </span>}
        actions={p.stock_status !== "ok" ? <LinkButton href={`/purchasing/new?part=${p.id}`} variant="accent">Order more</LinkButton> : undefined}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="animate-rise">
            <CardHeader title="Stock" icon={Package} />
            <div className="grid gap-4 p-4 sm:grid-cols-4 sm:p-5">
              <Info label="In stock" value={`${formatNumber(p.current_stock, 2)} ${p.unit}`} big />
              <Info label="Minimum" value={`${formatNumber(p.minimum_stock, 2)} ${p.unit}`} />
              <Info label="On order" value={p.on_order > 0 ? `${formatNumber(p.on_order, 2)} ${p.unit}` : "—"} />
              <Info label="Average cost" value={formatKES(p.average_cost)} />
            </div>
            <div className="px-4 pb-5 sm:px-5">
              <ProgressMeter percent={(Number(p.current_stock) / target) * 100} tone={st.tone}
                label={`Minimum level ${formatNumber(p.minimum_stock, 2)} ${p.unit}${p.supplier_name ? ` · usual supplier ${p.supplier_name}` : ""}`} />
            </div>
          </Card>

          <Card className="animate-rise">
            <CardHeader title="Stock movements" subtitle="Every change, oldest at the bottom" icon={ArrowLeftRight} />
            {movements && movements.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <tr><th className="px-5 py-2.5 font-semibold">When</th><th className="px-4 py-2.5 font-semibold">What</th><th className="px-4 py-2.5 text-right font-semibold">Change</th><th className="px-5 py-2.5 text-right font-semibold">Balance</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((m) => {
                      const qty = Number(m.quantity);
                      const asset = m.asset as unknown as { name: string } | null;
                      const person = m.person as unknown as { full_name: string } | null;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/60">
                          <td className="whitespace-nowrap px-5 py-2.5 text-slate-600">{formatDateTime(m.created_at)}</td>
                          <td className="px-4 py-2.5">
                            {MOVEMENT_LABEL[m.movement_type] ?? m.movement_type}
                            <div className="text-xs text-slate-500">
                              {[asset?.name, m.reference, m.reason, person?.full_name].filter(Boolean).join(" · ") || "—"}
                            </div>
                          </td>
                          <td className={cn("px-4 py-2.5 text-right font-medium tabular", qty > 0 ? "text-emerald-600" : "text-slate-700")}>{qty > 0 ? "+" : ""}{formatNumber(qty, 2)}</td>
                          <td className="px-5 py-2.5 text-right tabular text-slate-600">{formatNumber(m.balance_after, 2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No movements yet" icon={ArrowLeftRight} />}
          </Card>

          {manage && (
            <Card className="animate-rise">
              <CardHeader title="Part details" icon={Settings2} />
              <div className="p-4 sm:p-5"><PartForm part={p as unknown as Record<string, unknown>} suppliers={suppliers ?? []} isNew={false} /></div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {canMove && (
            <Card className="animate-rise lg:sticky lg:top-6">
              <CardHeader title="Move stock" subtitle={`Now: ${formatNumber(p.current_stock, 2)} ${p.unit}`} icon={ArrowLeftRight} />
              <div className="p-4 sm:p-5">
                <MovementForm partId={p.id} unit={p.unit} assets={assets ?? []} canIssue />
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Info({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn("mt-1 font-semibold tabular text-slate-900", big && "text-2xl")}>{value}</p>
    </div>
  );
}
