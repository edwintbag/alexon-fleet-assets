import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireUser, canEditFleet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssetStatusRow, ComplianceRow } from "@/lib/attention";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { COMPLIANCE_STATUS, OPERATIONAL_STATUS, SERVICE_STATUS } from "@/lib/status";
import { daysAgo, formatDate, formatDateTime, formatKES, formatMeter, formatNumber, formatReg, todayNairobi, unitFor } from "@/lib/format";
import { ReadingForm } from "@/components/assets/reading-form";
import { ServiceForm } from "@/components/assets/service-form";
import { PlanForm } from "@/components/assets/plan-form";

export default async function AssetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string; reading_error?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: a }, { data: asset }, { data: readings }, { data: services }, { data: docs }] = await Promise.all([
    supabase.from("v_asset_service_status").select("*").eq("id", id).maybeSingle(),
    supabase.from("assets").select("make, model, notes, responsible:profiles!assets_responsible_user_id_fkey(full_name, email)").eq("id", id).maybeSingle(),
    supabase.from("meter_readings").select("id, reading, previous_reading, reading_at, source, note, flagged, recorder:profiles!meter_readings_recorded_by_fkey(full_name)").eq("asset_id", id).order("reading_at", { ascending: false }).limit(15),
    supabase.from("service_records").select("id, service_date, meter_at_service, service_type, performed_by, cost, notes, next_due_meter_set, next_due_date_set").eq("asset_id", id).order("service_date", { ascending: false }).limit(20),
    supabase.from("v_compliance_status").select("*").eq("asset_id", id).order("expiry_date"),
  ]);
  if (!a) notFound();
  const row = a as AssetStatusRow;
  const unit = unitFor(row.meter_type) || "km";
  const hasMeter = row.meter_type !== "none";
  const s = SERVICE_STATUS[row.service_status];
  const o = OPERATIONAL_STATUS[row.operational_status];
  const edit = canEditFleet(user.role);
  const responsible = (asset?.responsible as unknown as { full_name: string; email: string } | null);

  // progress towards next service
  let progress: number | null = null;
  if (hasMeter && row.interval_meter && row.next_due_meter !== null && row.current_reading !== null) {
    const start = row.next_due_meter - row.interval_meter;
    progress = Math.max(0, Math.min(100, ((row.current_reading - start) / row.interval_meter) * 100));
  }
  const barColor = { red: "bg-red-600", orange: "bg-orange-700", amber: "bg-amber-500", blue: "bg-sky-500", green: "bg-emerald-500", slate: "bg-slate-400" }[s.tone];

  return (
    <>
      {sp.created && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Asset created. Now set up its service plan below.{sp.reading_error ? " (The initial reading could not be saved — add it below.)" : ""}</p>}
      {sp.saved && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Changes saved.</p>}

      <PageHeader
        title={row.name}
        subtitle={[formatReg(row.registration_number), row.category, [asset?.make, asset?.model].filter(Boolean).join(" ")].filter((x) => x && x !== "—").join(" · ")}
        actions={edit ? <LinkButton href={`/assets/${row.id}/edit`}><Pencil className="h-4 w-4" /> Edit</LinkButton> : undefined}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={s.tone}>Service: {s.label}</Badge>
        <Badge tone={o.tone}>{o.label}</Badge>
        {hasMeter && row.reading_stale && <Badge tone="amber">Reading {row.reading_at ? daysAgo(row.reading_age_days) : "date unknown"}</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Service status */}
          <Card>
            <CardHeader title="Service status" />
            <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
              <Info label="Current reading" value={hasMeter ? formatMeter(row.current_reading, row.meter_type) : "No meter"} sub={hasMeter ? (row.reading_at ? daysAgo(row.reading_age_days) : row.current_reading !== null ? "date unknown" : undefined) : undefined} />
              <Info label="Next service" value={[row.next_due_meter !== null ? formatMeter(row.next_due_meter, row.meter_type) : null, row.next_due_date ? formatDate(row.next_due_date) : null].filter(Boolean).join(" / ") || "Not set"} />
              <Info
                label="Remaining"
                value={[
                  row.remaining_meter !== null ? (row.remaining_meter < 0 ? `${formatNumber(-row.remaining_meter)} ${unit} overdue` : `${formatNumber(row.remaining_meter)} ${unit}`) : null,
                  row.remaining_days !== null ? (row.remaining_days < 0 ? `${-row.remaining_days} days overdue` : `${row.remaining_days} days`) : null,
                ].filter(Boolean).join(" / ") || "—"}
              />
              <Info label="Last service" value={[row.last_service_meter !== null ? formatMeter(row.last_service_meter, row.meter_type) : null, row.last_service_date ? formatDate(row.last_service_date) : null].filter(Boolean).join(" · ") || "—"} />
              <Info label="Interval" value={[row.interval_meter ? `every ${formatNumber(row.interval_meter)} ${unit}` : null, row.interval_days ? `every ${row.interval_days} days` : null].filter(Boolean).join(" / ") || "—"} />
              <Info label="Responsible" value={responsible?.full_name || responsible?.email || "Not assigned"} />
            </div>
            {progress !== null && (
              <div className="px-4 pb-5 sm:px-5">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full ${barColor}`} style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{Math.round(progress)}% of the service interval used</p>
              </div>
            )}
          </Card>

          {edit && (
            <Card id="service">
              <CardHeader title="Mark service complete" subtitle="Records the service and schedules the next one" />
              <div className="p-4 sm:p-5">
                {row.has_plan ? (
                  <ServiceForm assetId={row.id} unit={unit} today={todayNairobi()} currentReading={row.current_reading} hasMeter={hasMeter} lastServiceType={row.service_type_note} />
                ) : (
                  <p className="text-sm text-slate-600">Set up the service plan first (below).</p>
                )}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Service history" />
            {services && services.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Reading</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Done by</th><th className="px-4 py-2 text-right">Cost</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {services.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2 whitespace-nowrap">{formatDate(r.service_date)}</td>
                        <td className="px-4 py-2 tabular">{formatMeter(r.meter_at_service, row.meter_type)}</td>
                        <td className="px-4 py-2">{r.service_type ?? "—"}{r.notes && <div className="text-xs text-slate-500">{r.notes}</div>}</td>
                        <td className="px-4 py-2">{r.performed_by ?? "—"}</td>
                        <td className="px-4 py-2 text-right tabular">{formatKES(r.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No services recorded yet" />
            )}
          </Card>

          {edit && (
            <Card id="plan">
              <CardHeader title="Service plan" subtitle="Interval and where the asset is up to" />
              <div className="p-4 sm:p-5">
                <PlanForm assetId={row.id} unit={unit} hasMeter={hasMeter} plan={row.has_plan ? row : null} />
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {edit && hasMeter && (
            <Card id="reading">
              <CardHeader title="Update reading" subtitle={`Current: ${formatMeter(row.current_reading, row.meter_type)}`} />
              <div className="p-4 sm:p-5">
                <ReadingForm assetId={row.id} unit={unit} isAdmin={user.role === "admin"} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Compliance" right={edit ? <Link href={`/compliance/new?asset=${row.id}`} className="text-sm font-medium text-navy hover:underline">+ Add</Link> : undefined} />
            {docs && docs.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {(docs as ComplianceRow[]).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{d.document_type}</p>
                      <p className="text-xs text-slate-500">Expires {formatDate(d.expiry_date)}</p>
                    </div>
                    <Badge tone={COMPLIANCE_STATUS[d.status].tone}>{COMPLIANCE_STATUS[d.status].label}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No documents" />
            )}
          </Card>

          <Card>
            <CardHeader title="Reading history" />
            {readings && readings.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {readings.map((r) => (
                  <li key={r.id} className="px-4 py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium tabular">{formatMeter(r.reading, row.meter_type)}</span>
                      <span className="text-xs text-slate-500">{r.source === "import" ? "Imported" : formatDateTime(r.reading_at)}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {r.source === "correction" ? "Correction" : r.source === "service" ? "At service" : r.source === "import" ? "From Excel" : "Manual"}
                      {(r.recorder as unknown as { full_name: string } | null)?.full_name ? ` · ${(r.recorder as unknown as { full_name: string }).full_name}` : ""}
                      {r.flagged ? " · confirmed unusual jump" : ""}
                      {r.note ? ` · ${r.note}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No readings yet" />
            )}
          </Card>

          {asset?.notes && (
            <Card>
              <CardHeader title="Notes" />
              <p className="whitespace-pre-line p-4 text-sm text-slate-700">{asset.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-medium tabular text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
