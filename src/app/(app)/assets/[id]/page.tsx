import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, FileCheck2, FileText, Gauge, History, Paperclip, Pencil, Settings2, StickyNote, TriangleAlert, Wrench } from "lucide-react";
import { requireUser, canEditFleet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssetStatusRow, ComplianceRow } from "@/lib/attention";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, ProgressMeter, TONE_TEXT, buttonClass, cn } from "@/components/ui";
import { COMPLIANCE_STATUS, OPERATIONAL_STATUS, SERVICE_STATUS } from "@/lib/status";
import { daysAgo, formatDate, formatDateTime, formatKES, formatMeter, formatNumber, formatReg, todayNairobi, unitFor } from "@/lib/format";
import { FileUpload } from "@/components/assets/file-upload";
import { ReadingForm } from "@/components/assets/reading-form";
import { ServiceForm } from "@/components/assets/service-form";
import { PlanForm } from "@/components/assets/plan-form";
import { deleteAssetFile } from "../actions";
import { ConfirmSubmit } from "@/components/form-bits";

export default async function AssetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string; reading_error?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: a }, { data: asset }, { data: readings }, { data: services }, { data: docs }, { data: settings }, { data: files }] = await Promise.all([
    supabase.from("v_asset_service_status").select("*").eq("id", id).maybeSingle(),
    supabase.from("assets").select("make, model, notes, driver_name, co_driver_name, responsible:profiles!assets_responsible_user_id_fkey(full_name, email)").eq("id", id).maybeSingle(),
    supabase.from("meter_readings").select("id, reading, reading_at, source, note, flagged, recorder:profiles!meter_readings_recorded_by_fkey(full_name)").eq("asset_id", id).order("reading_at", { ascending: false }).limit(15),
    supabase.from("service_records").select("id, service_date, meter_at_service, service_type, performed_by, cost, notes").eq("asset_id", id).order("service_date", { ascending: false }).limit(20),
    supabase.from("v_compliance_status").select("*").eq("asset_id", id).order("expiry_date"),
    supabase.from("app_settings").select("*").maybeSingle(),
    supabase.from("asset_files").select("id, title, kind, service_record_id, created_at, uploader:profiles!asset_files_uploaded_by_fkey(full_name)").eq("asset_id", id).order("created_at", { ascending: false }),
  ]);
  if (!a) notFound();

  const row = a as AssetStatusRow;
  const unit = unitFor(row.meter_type) || "km";
  const hasMeter = row.meter_type !== "none";
  const s = SERVICE_STATUS[row.service_status];
  const o = OPERATIONAL_STATUS[row.operational_status];
  const edit = canEditFleet(user.role);
  const responsible = asset?.responsible as unknown as { full_name: string; email: string } | null;
  const fileList = (files ?? []) as { id: string; title: string; kind: string; service_record_id: string | null; created_at: string; uploader: unknown }[];
  const filesByService = new Map<string, { id: string; title: string }[]>();
  for (const f of fileList) {
    if (!f.service_record_id) continue;
    const list = filesByService.get(f.service_record_id) ?? [];
    list.push({ id: f.id, title: f.title });
    filesByService.set(f.service_record_id, list);
  }
  const isHours = row.meter_type === "hours";
  const thresholds = {
    approaching: Number(isHours ? settings?.hours_approaching ?? 50 : settings?.km_approaching ?? 3000),
    due_soon: Number(isHours ? settings?.hours_due_soon ?? 20 : settings?.km_due_soon ?? 1000),
    due_window: Number(isHours ? settings?.hours_due_window ?? 5 : settings?.km_due_window ?? 250),
    grace: Number(isHours ? settings?.hours_overdue_grace ?? 0 : settings?.km_overdue_grace ?? 0),
  };

  let progress: number | null = null;
  if (hasMeter && row.interval_meter && row.next_due_meter !== null && row.current_reading !== null) {
    const start = row.next_due_meter - row.interval_meter;
    progress = ((row.current_reading - start) / row.interval_meter) * 100;
  }

  return (
    <>
      {sp.created && <p className="mb-4 animate-pop rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/15">Asset created. Set up its service plan below.{sp.reading_error ? " (The first reading could not be saved — add it on the right.)" : ""}</p>}
      {sp.saved && <p className="mb-4 animate-pop rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/15">Changes saved.</p>}

      <nav className="mb-3 text-sm text-slate-500"><Link href="/assets" className="hover:text-navy hover:underline">Fleet</Link> <span className="text-slate-300">/</span> <span className="text-slate-700">{row.name}</span></nav>

      <PageHeader
        title={row.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={s.tone} size="md">Service: {s.label}</Badge>
            <Badge tone={o.tone} icon={false} size="md">{o.label}</Badge>
            {hasMeter && row.reading_stale && <Badge tone="amber" size="md">Reading {row.reading_at ? daysAgo(row.reading_age_days) : "date unknown"}</Badge>}
          </span>
        }
        actions={
          <>
            <LinkButton href={`/breakdowns/new?asset=${row.id}`}><TriangleAlert className="h-4 w-4" /> Report breakdown</LinkButton>
            {edit && <LinkButton href={`/assets/${row.id}/edit`}><Pencil className="h-4 w-4" /> Edit</LinkButton>}
          </>
        }
      />

      <p className="-mt-2 mb-5 text-sm text-slate-500">
        {[formatReg(row.registration_number), row.category, [asset?.make, asset?.model].filter(Boolean).join(" ")].filter((x) => x && x !== "—").join(" · ")}
      </p>

      {(asset?.driver_name || asset?.co_driver_name) && (
        <p className="-mt-3 mb-5 text-sm text-slate-600">
          {[
            asset?.driver_name ? `${row.asset_class === "machinery" || row.asset_class === "equipment" ? "Operator" : "Driver"}: ${asset.driver_name}` : null,
            asset?.co_driver_name ? `${row.asset_class === "machinery" || row.asset_class === "equipment" ? "Assistant" : "Co-driver"}: ${asset.co_driver_name}` : null,
          ].filter(Boolean).join(" · ")}
        </p>
      )}

      {/* Mobile quick actions */}
      {edit && (
        <div className="mb-5 flex gap-2 md:hidden">
          {hasMeter && <a href="#reading" className={cn(buttonClass.primary, "flex-1")}><Gauge className="h-4 w-4" /> Update reading</a>}
          {row.has_plan && <a href="#service" className={cn(buttonClass.secondary, "flex-1")}><Wrench className="h-4 w-4" /> Serviced</a>}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="animate-rise">
            <CardHeader title="Service status" icon={Gauge} />
            <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
              <Info label="Current reading" value={hasMeter ? formatMeter(row.current_reading, row.meter_type) : "No meter"} sub={hasMeter && row.current_reading !== null ? (row.reading_at ? daysAgo(row.reading_age_days) : "date unknown") : undefined} warn={row.reading_stale && hasMeter} />
              <Info label="Next service" value={[row.next_due_meter !== null ? formatMeter(row.next_due_meter, row.meter_type) : null, row.next_due_date ? formatDate(row.next_due_date) : null].filter(Boolean).join(" / ") || "Not set"} />
              <Info
                label="Remaining"
                tone={s.tone}
                value={[
                  row.remaining_meter !== null ? (row.remaining_meter < 0 ? `${formatNumber(-row.remaining_meter)} ${unit} over` : `${formatNumber(row.remaining_meter)} ${unit}`) : null,
                  row.remaining_days !== null ? (row.remaining_days < 0 ? `${-row.remaining_days} days over` : `${row.remaining_days} days`) : null,
                ].filter(Boolean).join(" / ") || "—"}
              />
              <Info label="Last service" value={[row.last_service_meter !== null ? formatMeter(row.last_service_meter, row.meter_type) : null, row.last_service_date ? formatDate(row.last_service_date) : null].filter(Boolean).join(" · ") || "—"} />
              <Info label="Interval" value={[row.interval_meter ? `${formatNumber(row.interval_meter)} ${unit}` : null, row.interval_days ? `${row.interval_days} days` : null].filter(Boolean).join(" / ") || "—"} />
              <Info label="Responsible" value={responsible?.full_name || responsible?.email || "Not assigned"} />
            </div>
            {progress !== null && (
              <div className="px-4 pb-5 sm:px-5">
                <ProgressMeter percent={progress} tone={s.tone} label={`${Math.round(Math.min(progress, 999))}% of the interval used${progress > 100 ? " — past due" : ""}`} />
              </div>
            )}
          </Card>

          {edit && (
            <Card id="service" className="animate-rise scroll-mt-20">
              <CardHeader title="Mark service complete" subtitle="Records the service and schedules the next one" icon={Wrench} />
              <div className="p-4 sm:p-5">
                {row.has_plan ? (
                  <ServiceForm assetId={row.id} unit={unit} today={todayNairobi()} currentReading={row.current_reading} hasMeter={hasMeter} lastServiceType={row.service_type_note} />
                ) : (
                  <p className="text-sm text-slate-600">Set up the service plan first — see <a href="#plan" className="font-medium text-navy underline">Service plan</a> below.</p>
                )}
              </div>
            </Card>
          )}

          <Card className="animate-rise">
            <CardHeader title="Service history" icon={History} subtitle={services?.length ? `${services.length} recorded` : undefined} />
            {services && services.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <tr><th className="px-5 py-2.5 font-semibold">Date</th><th className="px-4 py-2.5 font-semibold">Reading</th><th className="px-4 py-2.5 font-semibold">Type</th><th className="px-4 py-2.5 font-semibold">Done by</th><th className="px-5 py-2.5 text-right font-semibold">Cost</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {services.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-5 py-2.5">{formatDate(r.service_date)}</td>
                        <td className="px-4 py-2.5 tabular">{formatMeter(r.meter_at_service, row.meter_type)}</td>
                        <td className="px-4 py-2.5">
                          {r.service_type ?? "—"}
                          {r.notes && <div className="text-xs text-slate-500">{r.notes}</div>}
                          {(filesByService.get(r.id) ?? []).map((f) => (
                            <a key={f.id} href={`/api/asset-files/${f.id}`} target="_blank" rel="noopener"
                               className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-navy hover:underline">
                              <Paperclip className="h-3 w-3" /> {f.title}
                            </a>
                          ))}
                        </td>
                        <td className="px-4 py-2.5">{r.performed_by ?? "—"}</td>
                        <td className="px-5 py-2.5 text-right tabular">{formatKES(r.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No services recorded yet" icon={Wrench}>The first one you record starts the history.</EmptyState>}
          </Card>

          {edit && (
            <Card id="plan" className="animate-rise scroll-mt-20">
              <CardHeader title="Service plan" subtitle="Interval and where this asset is up to" icon={Settings2} />
              <div className="p-4 sm:p-5"><PlanForm assetId={row.id} unit={unit} hasMeter={hasMeter} plan={row.has_plan ? row : null} /></div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {edit && hasMeter && (
            <Card id="reading" className="animate-rise scroll-mt-20 lg:sticky lg:top-6">
              <CardHeader title="Update reading" subtitle={`Current: ${formatMeter(row.current_reading, row.meter_type)}`} icon={Gauge} />
              <div className="p-4 sm:p-5">
                <ReadingForm assetId={row.id} unit={unit} isAdmin={user.role === "admin"} currentReading={row.current_reading} nextDue={row.next_due_meter} thresholds={thresholds} />
              </div>
            </Card>
          )}

          <Card className="animate-rise">
            <CardHeader title="Compliance" icon={FileCheck2} right={edit ? <Link href={`/compliance/new?asset=${row.id}`} className="text-sm font-medium text-navy hover:underline">+ Add</Link> : undefined} />
            {docs && docs.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {(docs as ComplianceRow[]).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{d.document_type}</p>
                      <p className="text-xs text-slate-500">Expires {formatDate(d.expiry_date)}</p>
                    </div>
                    <Badge tone={COMPLIANCE_STATUS[d.status].tone}>{COMPLIANCE_STATUS[d.status].label}</Badge>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No documents" icon={FileCheck2}>{edit && <Link href={`/compliance/new?asset=${row.id}`} className="font-medium text-navy underline">Add insurance or inspection</Link>}</EmptyState>}
          </Card>

          <Card className="animate-rise">
            <CardHeader title="Reading history" icon={CalendarClock} />
            {readings && readings.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {readings.map((r) => (
                  <li key={r.id} className="px-4 py-2.5 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium tabular text-slate-900">{formatMeter(r.reading, row.meter_type)}</span>
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
            ) : <EmptyState title="No readings yet" icon={Gauge} />}
          </Card>

          <Card className="animate-rise">
            <CardHeader title="Documents" subtitle="Invoices, job cards, logbook" icon={FileText} />
            {fileList.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {fileList.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <a href={`/api/asset-files/${f.id}`} target="_blank" rel="noopener" className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 hover:underline">{f.title}</p>
                      <p className="text-xs capitalize text-slate-500">{f.kind.replace("_", " ")} · {formatDate(f.created_at)}</p>
                    </a>
                    {user.role === "admin" && (
                      <form action={deleteAssetFile}>
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="asset_id" value={row.id} />
                        <ConfirmSubmit message="Delete this file?" className="text-xs text-slate-400 hover:text-red-700">Delete</ConfirmSubmit>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No documents" icon={FileText}>Upload invoices and job cards here.</EmptyState>}
            {edit && <div className="border-t border-slate-100 bg-slate-50/60 p-4"><FileUpload assetId={row.id} /></div>}
          </Card>

          {asset?.notes && (
            <Card className="animate-rise">
              <CardHeader title="Notes" icon={StickyNote} />
              <p className="whitespace-pre-line p-4 text-sm leading-relaxed text-slate-700">{asset.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Info({ label, value, sub, tone, warn }: { label: string; value: string; sub?: string; tone?: keyof typeof TONE_TEXT; warn?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn("mt-1 font-semibold tabular", tone ? TONE_TEXT[tone] : "text-slate-900")}>{value}</p>
      {sub && <p className={cn("text-xs", warn ? "font-medium text-amber-600" : "text-slate-500")}>{sub}</p>}
    </div>
  );
}
