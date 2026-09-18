import Link from "next/link";
import { BarChart3, Download, TriangleAlert, Wrench } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getReport, periodRange } from "@/lib/report";
import { Card, CardHeader, EmptyState, PageHeader, StatCard, buttonClass, cn } from "@/components/ui";
import { SendReport } from "@/components/reports/send-report";
import { formatDate, formatKES, formatNumber } from "@/lib/format";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = sp.period === "week" ? "week" : "month";
  const { from, to, label } = periodRange(period);
  const supabase = await createClient();
  const report = await getReport(supabase, from, to);

  if (!report) {
    return (
      <>
        <PageHeader title="Reports" />
        <Card><EmptyState title="Report not available" icon={BarChart3}>Run supabase/05_reports.sql in Supabase, then reload.</EmptyState></Card>
      </>
    );
  }

  const spend = Number(report.services_done.cost) + Number(report.breakdowns.cost);
  const canEmail = user.role === "admin" || user.role === "management";

  return (
    <>
      <PageHeader
        title="Management report"
        subtitle={`${label} · ${formatDate(report.from)} to ${formatDate(report.to)}`}
        actions={
          <a href={`/api/export/services?from=${from}&to=${to}`} className={buttonClass.secondary}>
            <Download className="h-4 w-4" /> Services CSV
          </a>
        }
      />

      <div className="mb-5 flex gap-1 text-sm">
        {[["month", "This month"], ["week", "Last 7 days"]].map(([k, l]) => (
          <Link key={k} href={`/reports?period=${k}`} className={cn("rounded-full px-3 py-1 text-xs font-medium transition", period === k ? "bg-navy text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50")}>{l}</Link>
        ))}
      </div>

      <div className="stagger mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Services done" value={report.services_done.count} icon={Wrench} sub={formatKES(report.services_done.cost)} />
        <StatCard label="Breakdowns" value={report.breakdowns.reported} tone={report.breakdowns.reported ? "amber" : "slate"} icon={TriangleAlert} sub={`${formatNumber(report.breakdowns.downtime_hours, 1)} hrs down`} />
        <StatCard label="Maintenance spend" value={formatKES(spend)} icon={BarChart3} sub="services + repairs" />
        <StatCard label="Overdue now" value={report.service.overdue} tone={report.service.overdue ? "red" : "green"} sub={`${report.service.due} due soon`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="animate-rise">
          <CardHeader title="Fleet position today" />
          <dl className="divide-y divide-slate-100 text-sm">
            <Row label="Assets" value={String(report.assets.total)} />
            <Row label="Operational" value={String(report.assets.operational)} />
            <Row label="In maintenance" value={String(report.assets.maintenance)} />
            <Row label="Broken down" value={String(report.assets.breakdown)} tone={report.assets.breakdown ? "red" : undefined} />
            <Row label="Readings out of date" value={String(report.service.stale_readings)} tone={report.service.stale_readings ? "amber" : undefined} />
            <Row label="Documents expired / expiring" value={`${report.compliance.expired} / ${report.compliance.expiring}`} tone={report.compliance.expired ? "red" : undefined} />
          </dl>
        </Card>

        <Card className="animate-rise">
          <CardHeader title="Stores" />
          <dl className="divide-y divide-slate-100 text-sm">
            <Row label="Stock value" value={formatKES(report.parts.stock_value)} />
            <Row label="Low stock" value={String(report.parts.low)} tone={report.parts.low ? "amber" : undefined} />
            <Row label="Out of stock" value={String(report.parts.out)} tone={report.parts.out ? "red" : undefined} />
            <Row label="Purchases received" value={formatKES(report.purchasing.received_value)} />
            <Row label="Awaiting approval" value={String(report.purchasing.awaiting_approval)} tone={report.purchasing.awaiting_approval ? "amber" : undefined} />
          </dl>
        </Card>
      </div>

      <Card className="animate-rise mt-5">
        <CardHeader title="Where the money went" subtitle={`Top assets by spend · total ${formatKES(spend)}`} />
        {report.top_costs.length === 0 ? (
          <EmptyState title="No maintenance spend recorded in this period" icon={BarChart3} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-2.5 font-semibold">Asset</th><th className="px-4 py-2.5 text-right font-semibold">Services</th><th className="px-4 py-2.5 text-right font-semibold">Repairs</th><th className="px-5 py-2.5 text-right font-semibold">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.top_costs.map((t) => (
                  <tr key={t.name} className="hover:bg-slate-50/60">
                    <td className="px-5 py-2.5">{t.name} {t.reg && <span className="text-xs text-slate-400">{t.reg}</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular">{formatKES(t.service_cost)}</td>
                    <td className="px-4 py-2.5 text-right tabular">{formatKES(t.repair_cost)}</td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular">{formatKES(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canEmail && (
        <Card className="animate-rise mt-5">
          <CardHeader title="Send this report" subtitle="Goes to everyone with an Admin or Management account, plus any extra addresses in Settings" />
          <div className="p-4 sm:p-5"><SendReport period={period} /></div>
        </Card>
      )}

      <p className="mt-4 text-center text-xs text-slate-400">
        Sent automatically: weekly on Monday morning, and on the 1st of each month.
      </p>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "red" | "amber" }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
      <dt className="text-slate-600">{label}</dt>
      <dd className={cn("font-semibold tabular", tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-slate-900")}>{value}</dd>
    </div>
  );
}
