import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, PackageCheck, ShoppingCart, XCircle } from "lucide-react";
import { requireUser, canApprovePurchase, canManageStock, canRequestPurchase } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PurchaseRequestRow } from "@/lib/attention";
import { Badge, Card, CardHeader, PageHeader, buttonClass, cn, inputClass } from "@/components/ui";
import { ConfirmSubmit } from "@/components/form-bits";
import { PR_STATUS } from "@/lib/status";
import { formatDate, formatKES, formatNumber } from "@/lib/format";
import { AddItemForm, ReceiveForm } from "@/components/purchasing/forms";
import { removeItem, transitionRequest } from "../actions";

export default async function PurchaseRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; error?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data }, { data: items }, { data: parts }] = await Promise.all([
    supabase.from("v_purchase_requests").select("*").eq("id", id).maybeSingle(),
    supabase.from("purchase_request_items").select("*, part:spare_parts(name, unit, average_cost)").eq("purchase_request_id", id).order("description"),
    supabase.from("v_part_stock_status").select("id, name, unit, reorder_quantity, current_stock, minimum_stock, average_cost").order("name"),
  ]);
  if (!data) notFound();
  const r = data as PurchaseRequestRow;
  const st = PR_STATUS[r.status];
  const lines = items ?? [];
  const isDraft = r.status === "draft";
  const canEditItems = isDraft && canRequestPurchase(user.role);
  const canApprove = r.status === "submitted" && canApprovePurchase(user.role) && r.requested_by !== user.id;
  const canReceive = ["approved", "ordered"].includes(r.status) && canManageStock(user.role);
  const total = lines.reduce((sum, i) => sum + Number(i.quantity) * Number(i.estimated_unit_cost ?? 0), 0);

  const Action = ({ to, label, variant = "secondary", confirm }: { to: string; label: string; variant?: keyof typeof buttonClass; confirm?: string }) => (
    <form action={transitionRequest}>
      <input type="hidden" name="id" value={r.id} />
      <input type="hidden" name="to" value={to} />
      {confirm
        ? <ConfirmSubmit message={confirm} className={buttonClass[variant]}>{label}</ConfirmSubmit>
        : <button className={buttonClass[variant]}>{label}</button>}
    </form>
  );

  return (
    <>
      {sp.created && <p className="mb-4 animate-pop rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/15">Request created as a draft. Add any other items, then submit it for approval.</p>}
      {sp.error && <p className="mb-4 animate-pop rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-600/15">{sp.error}</p>}

      <nav className="mb-3 text-sm text-slate-500"><Link href="/purchasing" className="hover:text-navy hover:underline">Purchasing</Link> <span className="text-slate-300">/</span> <span className="text-slate-700">{r.request_number}</span></nav>

      <PageHeader
        title={r.request_number}
        subtitle={<span className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone} icon={false} size="md">{st.label}</Badge>
          <span className="text-sm text-slate-500">
            {r.requested_by_name ? `Requested by ${r.requested_by_name}` : ""} · {formatDate(r.created_at)}
            {r.supplier_name ? ` · ${r.supplier_name}` : ""}
          </span>
        </span>}
        actions={
          <div className="flex flex-wrap gap-2">
            {isDraft && canRequestPurchase(user.role) && <Action to="submitted" label="Submit for approval" variant="primary" />}
            {canApprove && <Action to="approved" label="Approve" variant="primary" confirm="Approve this purchase request?" />}
            {r.status === "approved" && canManageStock(user.role) && <Action to="ordered" label="Mark ordered" variant="secondary" />}
            {!["received", "cancelled"].includes(r.status) && <Action to="cancelled" label="Cancel" variant="danger" confirm="Cancel this request?" />}
          </div>
        }
      />

      {r.status === "submitted" && canApprovePurchase(user.role) && r.requested_by === user.id && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-600/20">You raised this request, so someone else must approve it.</p>
      )}
      {r.status === "rejected" && r.rejection_reason && (
        <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-600/15">Rejected: {r.rejection_reason}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="animate-rise">
            <CardHeader title="Items" subtitle={total > 0 ? `Estimated total ${formatKES(total)}` : undefined} icon={ShoppingCart} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">Item</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Qty</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Unit cost</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Received</th>
                    {(canEditItems || canReceive) && <th className="px-5 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((i) => {
                    const part = i.part as unknown as { name: string; unit: string; average_cost: number } | null;
                    const outstanding = Number(i.quantity) - Number(i.received_quantity);
                    return (
                      <tr key={i.id} className="align-top hover:bg-slate-50/60">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">{i.description}</p>
                          {part && <p className="text-xs text-slate-500">Stocked part · {part.unit}</p>}
                        </td>
                        <td className="px-4 py-3 text-right tabular">{formatNumber(i.quantity, 2)}</td>
                        <td className="px-4 py-3 text-right tabular text-slate-600">{i.estimated_unit_cost ? formatKES(i.estimated_unit_cost) : "—"}</td>
                        <td className={cn("px-4 py-3 text-right tabular", outstanding === 0 ? "text-emerald-600" : "text-slate-600")}>{formatNumber(i.received_quantity, 2)}</td>
                        {(canEditItems || canReceive) && (
                          <td className="px-5 py-3 text-right">
                            {canEditItems && (
                              <form action={removeItem}>
                                <input type="hidden" name="id" value={i.id} />
                                <input type="hidden" name="purchase_request_id" value={r.id} />
                                <ConfirmSubmit message="Remove this item?" className="text-xs text-slate-500 hover:text-red-700">Remove</ConfirmSubmit>
                              </form>
                            )}
                            {canReceive && outstanding > 0 && (
                              <ReceiveForm itemId={i.id} requestId={r.id} outstanding={outstanding} unit={part?.unit ?? "pcs"} lastCost={i.estimated_unit_cost ?? part?.average_cost ?? null} />
                            )}
                            {canReceive && outstanding === 0 && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><PackageCheck className="h-4 w-4" /> Complete</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {canEditItems && (
              <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Add another item</p>
                <AddItemForm requestId={r.id} parts={(parts ?? []) as never} />
              </div>
            )}
          </Card>

          {canApprove && (
            <Card className="animate-rise">
              <CardHeader title="Decision" icon={CheckCircle2} />
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
                <form action={transitionRequest} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="to" value="rejected" />
                  <label className="flex-1 space-y-1.5 text-sm">
                    <span className="font-medium text-slate-700">Reason for rejecting</span>
                    <input name="note" className={inputClass} />
                  </label>
                  <button className={buttonClass.danger}><XCircle className="h-4 w-4" /> Reject</button>
                </form>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="animate-rise">
            <CardHeader title="Details" />
            <dl className="space-y-3 p-4 text-sm sm:p-5">
              <div><dt className="text-xs uppercase tracking-wider text-slate-500">Needed by</dt><dd className="font-medium">{r.needed_by ? formatDate(r.needed_by) : "—"}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-slate-500">Supplier</dt><dd className="font-medium">{r.supplier_name ?? "—"}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-slate-500">Reason</dt><dd className="whitespace-pre-line">{r.justification ?? "—"}</dd></div>
              {r.approved_by_name && <div><dt className="text-xs uppercase tracking-wider text-slate-500">Approved by</dt><dd className="font-medium">{r.approved_by_name} · {formatDate(r.approved_at)}</dd></div>}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
