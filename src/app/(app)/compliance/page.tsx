import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { requireUser, canEditFleet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ComplianceRow } from "@/lib/attention";
import { Badge, Card, EmptyState, LinkButton, PageHeader, cn } from "@/components/ui";
import { COMPLIANCE_STATUS } from "@/lib/status";
import { formatDate, formatKES, formatReg } from "@/lib/format";
import { retireDocument } from "./actions";
import { ConfirmSubmit } from "@/components/form-bits";

export const metadata = { title: "Compliance" };

export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ show?: string; saved?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_compliance_status").select("*").order("expiry_date");
  if (error) throw error;
  const all = (data ?? []) as ComplianceRow[];
  const show = sp.show ?? "attention";
  const rows = show === "all" ? all : all.filter((d) => d.status !== "valid");
  const edit = canEditFleet(user.role);

  return (
    <>
      {sp.saved && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Document saved.</p>}
      <PageHeader
        title="Compliance"
        subtitle={`${all.filter((d) => d.status === "expired").length} expired · ${all.filter((d) => d.status === "expiring_soon").length} expiring soon · ${all.length} current documents`}
        actions={edit ? <LinkButton href="/compliance/new" variant="primary"><Plus className="h-4 w-4" /> Add document</LinkButton> : undefined}
      />
      <div className="mb-4 flex gap-1 text-sm">
        {[["attention", "Expired & expiring"], ["all", "All current"]].map(([k, label]) => (
          <Link key={k} href={`/compliance?show=${k}`} className={cn("rounded-full px-3 py-1", show === k ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{label}</Link>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title={show === "all" ? "No documents yet" : "Nothing expired or expiring"}>
            {edit && <Link href="/compliance/new" className="underline">Add the first document</Link>}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold text-slate-900">{d.document_type}</span>
                    <span className="text-slate-400"> · </span>
                    {d.asset_id ? <Link href={`/assets/${d.asset_id}`} className="hover:underline">{d.asset_name}</Link> : "Company-wide"}
                    {d.registration_number && <span className="text-slate-500"> ({formatReg(d.registration_number)})</span>}
                  </p>
                  <p className="text-sm text-slate-600">
                    Expires {formatDate(d.expiry_date)}
                    {d.days_remaining < 0 ? ` — ${-d.days_remaining} day(s) ago` : d.days_remaining === 0 ? " — today" : ` — in ${d.days_remaining} day(s)`}
                    {d.document_number && ` · No. ${d.document_number}`}
                    {d.issuer && ` · ${d.issuer}`}
                    {d.cost !== null && ` · ${formatKES(d.cost)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={COMPLIANCE_STATUS[d.status].tone}>{COMPLIANCE_STATUS[d.status].label}</Badge>
                  {d.file_path && (
                    <a href={`/api/files/${d.id}`} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50">
                      <FileText className="h-4 w-4" /> File
                    </a>
                  )}
                  {edit && <Link href={`/compliance/new?renew=${d.id}`} className="inline-flex min-h-9 items-center rounded-lg bg-navy px-3 text-sm font-medium text-white hover:bg-navy-dark">Renew</Link>}
                  {edit && (
                    <form action={retireDocument}>
                      <input type="hidden" name="id" value={d.id} />
                      <ConfirmSubmit message="Remove this document from tracking? (It stays in history.)" className="min-h-9 rounded-lg px-2 text-sm text-slate-500 hover:text-red-700">Remove</ConfirmSubmit>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
