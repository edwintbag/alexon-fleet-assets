import Link from "next/link";
import { ChevronRight, Plus, ShoppingCart, Users } from "lucide-react";
import { requireUser, canRequestPurchase } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PurchaseRequestRow } from "@/lib/attention";
import { Badge, Card, EmptyState, LinkButton, PageHeader, cn } from "@/components/ui";
import { PR_STATUS } from "@/lib/status";
import { formatDate, formatKES } from "@/lib/format";

export const metadata = { title: "Purchasing" };

const TABS: [string, string][] = [
  ["open", "Open"], ["submitted", "Awaiting approval"], ["approved", "Approved / ordered"], ["received", "Received"], ["all", "All"],
];

export default async function PurchasingPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const show = TABS.some(([k]) => k === sp.show) ? sp.show! : "open";
  const supabase = await createClient();
  const { data } = await supabase.from("v_purchase_requests").select("*").order("created_at", { ascending: false }).limit(200);
  const all = (data ?? []) as PurchaseRequestRow[];

  const rows = all.filter((r) =>
    show === "all" ? true
    : show === "open" ? ["draft", "submitted", "approved", "ordered"].includes(r.status)
    : show === "approved" ? ["approved", "ordered"].includes(r.status)
    : r.status === show);

  return (
    <>
      <PageHeader
        title="Purchasing"
        subtitle={`${all.filter((r) => r.status === "submitted").length} awaiting approval · ${all.filter((r) => ["approved", "ordered"].includes(r.status)).length} in progress`}
        actions={
          <>
            <LinkButton href="/purchasing/suppliers"><Users className="h-4 w-4" /> Suppliers</LinkButton>
            {canRequestPurchase(user.role) && <LinkButton href="/purchasing/new" variant="primary"><Plus className="h-4 w-4" /> New request</LinkButton>}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 text-sm">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/purchasing?show=${k}`} className={cn("rounded-full px-3 py-1 text-xs font-medium transition", show === k ? "bg-navy text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50")}>{label}</Link>
        ))}
      </div>

      <Card className="animate-rise">
        {rows.length === 0 ? (
          <EmptyState title="Nothing here" icon={ShoppingCart}>
            {canRequestPurchase(user.role) && <Link href="/purchasing/new" className="font-medium text-navy underline">Create a purchase request</Link>}
          </EmptyState>
        ) : (
          <ul className="stagger divide-y divide-slate-100">
            {rows.map((r) => {
              const st = PR_STATUS[r.status];
              return (
                <li key={r.id}>
                  <Link href={`/purchasing/${r.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50/80 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold text-slate-900">{r.request_number}</span>
                        <span className="text-sm text-slate-500">{r.item_count} item(s)</span>
                        {r.supplier_name && <span className="text-xs text-slate-400">{r.supplier_name}</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDate(r.created_at)}{r.requested_by_name ? ` · ${r.requested_by_name}` : ""}
                        {r.needed_by ? ` · needed by ${formatDate(r.needed_by)}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge tone={st.tone} icon={false}>{st.label}</Badge>
                      {Number(r.estimated_total) > 0 && <p className="mt-1 text-xs tabular text-slate-500">{formatKES(r.estimated_total)}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
