import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, TriangleAlert, UserCog } from "lucide-react";
import { requireUser, canEditFleet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BreakdownRow } from "@/lib/attention";
import { Badge, Card, CardHeader, PageHeader, inputClass } from "@/components/ui";
import { BREAKDOWN_STATUS, SEVERITY } from "@/lib/status";
import { formatDateTime, formatKES, formatMeter, formatReg } from "@/lib/format";
import { ResolveForm } from "@/components/breakdowns/resolve-form";
import { updateBreakdown } from "../actions";

export default async function BreakdownPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reported?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: people }] = await Promise.all([
    supabase.from("v_breakdowns").select("*").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
  ]);
  if (!data) notFound();
  const b = data as BreakdownRow;
  const st = BREAKDOWN_STATUS[b.status];
  const sev = SEVERITY[b.severity];
  const edit = canEditFleet(user.role);
  const days = Math.floor(b.hours_down / 24);

  return (
    <>
      {sp.reported && <p className="mb-4 animate-pop rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/15">Breakdown {b.breakdown_number} reported.</p>}
      <nav className="mb-3 text-sm text-slate-500"><Link href="/breakdowns" className="hover:text-navy hover:underline">Breakdowns</Link> <span className="text-slate-300">/</span> <span className="text-slate-700">{b.breakdown_number}</span></nav>

      <PageHeader
        title={b.asset_name}
        subtitle={<span className="flex flex-wrap items-center gap-2">
          <Badge tone={sev.tone} size="md">{sev.label}</Badge>
          <Badge tone={st.tone} icon={false} size="md">{st.label}</Badge>
          {!b.asset_operable && b.status !== "resolved" && <Badge tone="red" size="md">Off the road</Badge>}
          <span className="text-sm text-slate-500">{formatReg(b.registration_number)}</span>
        </span>}
        actions={<Link href={`/assets/${b.asset_id}`} className="text-sm font-medium text-navy hover:underline">View asset →</Link>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="animate-rise">
            <CardHeader title="The problem" icon={TriangleAlert} />
            <div className="space-y-3 p-4 sm:p-5">
              <p className="whitespace-pre-line text-slate-800">{b.description}</p>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs uppercase tracking-wider text-slate-500">Reported</dt><dd className="font-medium">{formatDateTime(b.reported_at)}{b.reported_by_name ? ` · ${b.reported_by_name}` : ""}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-slate-500">Location</dt><dd className="font-medium">{b.location ?? "—"}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-slate-500">Reading at breakdown</dt><dd className="font-medium tabular">{b.meter_reading !== null ? formatMeter(b.meter_reading, b.meter_type) : "—"}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-slate-500">Down for</dt><dd className="font-medium tabular">{days >= 1 ? `${days} days` : `${Math.round(b.hours_down)} hours`}</dd></div>
              </dl>
            </div>
          </Card>

          {b.status === "resolved" ? (
            <Card className="animate-rise">
              <CardHeader title="Resolution" icon={CheckCircle2} />
              <div className="space-y-2 p-4 sm:p-5">
                <p className="whitespace-pre-line text-slate-800">{b.resolution_notes}</p>
                <p className="text-sm text-slate-500">
                  {b.resolved_at ? `Resolved ${formatDateTime(b.resolved_at)}` : ""}
                  {b.repair_cost !== null ? ` · Repair cost ${formatKES(b.repair_cost)}` : ""}
                </p>
              </div>
            </Card>
          ) : edit ? (
            <Card className="animate-rise">
              <CardHeader title="Resolve" subtitle="Record the repair and put the asset back in service" icon={CheckCircle2} />
              <div className="p-4 sm:p-5"><ResolveForm id={b.id} /></div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          {edit && b.status !== "resolved" && (
            <Card className="animate-rise">
              <CardHeader title="Progress" icon={UserCog} />
              <form action={updateBreakdown} className="space-y-3 p-4 sm:p-5">
                <input type="hidden" name="id" value={b.id} />
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-slate-700">Status</span>
                  <select name="status" defaultValue={b.status} className={inputClass}>
                    <option value="reported">Reported</option>
                    <option value="in_progress">In progress</option>
                    <option value="awaiting_parts">Awaiting parts</option>
                  </select>
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-slate-700">Assigned to</span>
                  <select name="assigned_to" defaultValue={""} className={inputClass}>
                    <option value="">— Nobody —</option>
                    {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
                  </select>
                </label>
                <button className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm transition hover:bg-slate-50 active:scale-[.98]">Update</button>
                {b.assigned_to_name && <p className="text-xs text-slate-500">Currently with {b.assigned_to_name}</p>}
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
