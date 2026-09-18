import Link from "next/link";
import { Plus, TriangleAlert, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CLASS_LABEL, classRank, type BreakdownRow } from "@/lib/attention";
import { Badge, Card, EmptyState, LinkButton, PageHeader, cn } from "@/components/ui";
import { BREAKDOWN_STATUS, SEVERITY } from "@/lib/status";
import { formatDateTime, formatKES, formatReg } from "@/lib/format";

export const metadata = { title: "Breakdowns" };

export default async function BreakdownsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const show = sp.show === "resolved" ? "resolved" : "open";
  const supabase = await createClient();
  const { data } = await supabase.from("v_breakdowns").select("*").order("reported_at", { ascending: false }).limit(200);
  const all = (data ?? []) as BreakdownRow[];
  const rows = all
    .filter((b) => (show === "open" ? b.status !== "resolved" : b.status === "resolved"))
    .sort((x, y) => classRank(x.asset_class ?? null) - classRank(y.asset_class ?? null) || +new Date(y.reported_at) - +new Date(x.reported_at));

  const groups = rows.reduce<{ label: string; rows: BreakdownRow[] }[]>((acc, b) => {
    const label = CLASS_LABEL[b.asset_class ?? ""] ?? "Other";
    const last = acc[acc.length - 1];
    if (last && last.label === label) last.rows.push(b);
    else acc.push({ label, rows: [b] });
    return acc;
  }, []);

  return (
    <>
      <PageHeader
        title="Breakdowns"
        subtitle={`${all.filter((b) => b.status !== "resolved").length} open · ${all.length} in total`}
        actions={<LinkButton href="/breakdowns/new" variant="accent"><Plus className="h-4 w-4" /> Report breakdown</LinkButton>}
      />
      <div className="mb-4 flex gap-1 text-sm">
        {[["open", "Open"], ["resolved", "Resolved"]].map(([k, label]) => (
          <Link key={k} href={`/breakdowns?show=${k}`} className={cn("rounded-full px-3 py-1 text-xs font-medium transition", show === k ? "bg-navy text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50")}>{label}</Link>
        ))}
      </div>

      <Card className="animate-rise">
        {rows.length === 0 ? (
          <EmptyState title={show === "open" ? "No open breakdowns" : "Nothing resolved yet"} icon={TriangleAlert}>
            {show === "open" ? "Every asset is running." : null}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {groups.map((g) => (
              <li key={g.label}>
                {groups.length > 1 && (
                  <p className="bg-slate-50/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-5">
                    {g.label} <span className="tabular text-slate-400">({g.rows.length})</span>
                  </p>
                )}
                <ul className="stagger divide-y divide-slate-100">
                  {g.rows.map((b) => {
                    const st = BREAKDOWN_STATUS[b.status];
                    const sev = SEVERITY[b.severity];
                    const days = Math.floor(b.hours_down / 24);
                    return (
                      <li key={b.id}>
                        <Link href={`/breakdowns/${b.id}`} className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-slate-50/80 sm:items-center sm:px-5">
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-semibold text-slate-900">{b.asset_name}</span>
                              <span className="text-xs text-slate-400">{formatReg(b.registration_number)}</span>
                              <span className="text-xs text-slate-400">{b.breakdown_number}</span>
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{b.description}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {formatDateTime(b.reported_at)}{b.reported_by_name ? ` · ${b.reported_by_name}` : ""}
                              {b.location ? ` · ${b.location}` : ""}
                              {b.status === "resolved" && b.repair_cost !== null ? ` · ${formatKES(b.repair_cost)}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <Badge tone={sev.tone}>{sev.label}</Badge>
                            <Badge tone={st.tone} icon={false}>{st.label}</Badge>
                            <span className="text-[11px] text-slate-400 tabular">{days >= 1 ? `${days} days down` : `${Math.round(b.hours_down)}h down`}</span>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 sm:mt-0" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
