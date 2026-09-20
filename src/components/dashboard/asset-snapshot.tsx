import Link from "next/link";
import {
  ArrowRight, Container, Gauge, ShieldAlert, ShieldCheck, Tractor, TriangleAlert, Truck, UserRound, Wrench,
} from "lucide-react";
import type { AssetStatusRow, AttentionItem, BreakdownRow, ComplianceRow } from "@/lib/attention";
import { complianceSummary, type RequiredDoc } from "@/lib/compliance";
import { COMPLIANCE_STATUS, OPERATIONAL_STATUS, SERVICE_STATUS, type Tone } from "@/lib/status";
import { Badge, ProgressMeter, TONE_TEXT, buttonClass, cn } from "@/components/ui";
import { daysAgo, formatDate, formatKES, formatMeter, formatNumber, formatReg, unitFor } from "@/lib/format";

export type SnapshotExtra = {
  driver_name: string | null;
  co_driver_name: string | null;
  make: string | null;
  model: string | null;
};

export type LastService = { service_date: string; service_type: string | null; performed_by: string | null; cost: number } | null;

const CLASS_ICON = { vehicle: Truck, machinery: Tractor, trailer: Container, equipment: Wrench } as const;

/** Vehicles have drivers; machines have operators. */
function crewLabels(assetClass: string) {
  return assetClass === "machinery" || assetClass === "equipment"
    ? { main: "Operator", second: "Assistant operator" }
    : { main: "Driver", second: "Co-driver" };
}

function Section({ title, icon: Icon, right, children }: { title: string; icon: typeof Truck; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <Icon className="h-3.5 w-3.5" aria-hidden /> {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  );
}

const DOC_TONE: Record<RequiredDoc["state"], Tone> = { valid: "green", expiring_soon: "amber", expired: "red", missing: "slate" };

function docLine(state: RequiredDoc["state"], doc: ComplianceRow | null) {
  if (!doc) return "Not on file";
  if (state === "expired") return `Expired ${formatDate(doc.expiry_date)}`;
  if (doc.days_remaining === 0) return "Expires today";
  return `Valid to ${formatDate(doc.expiry_date)}${state === "expiring_soon" ? ` · ${doc.days_remaining} days left` : ""}`;
}

export function AssetSnapshot({ row, extra, docs, breakdowns, items, lastService, canEdit }: {
  row: AssetStatusRow;
  extra: SnapshotExtra;
  docs: ComplianceRow[];
  breakdowns: BreakdownRow[];
  items: AttentionItem[];
  lastService: LastService;
  canEdit: boolean;
}) {
  const Icon = CLASS_ICON[row.asset_class as keyof typeof CLASS_ICON] ?? Truck;
  const s = SERVICE_STATUS[row.service_status];
  const o = OPERATIONAL_STATUS[row.operational_status] ?? OPERATIONAL_STATUS.operational;
  const hasMeter = row.meter_type !== "none";
  const unit = unitFor(row.meter_type);
  const crew = crewLabels(row.asset_class);
  const comp = complianceSummary(row.asset_class, docs);

  let progress: number | null = null;
  if (hasMeter && row.interval_meter && row.next_due_meter !== null && row.current_reading !== null) {
    progress = ((row.current_reading - (row.next_due_meter - row.interval_meter)) / row.interval_meter) * 100;
  }

  const remaining =
    row.remaining_meter !== null
      ? row.remaining_meter < 0 ? `${formatNumber(-row.remaining_meter)} ${unit} overdue` : `${formatNumber(row.remaining_meter)} ${unit} to go`
      : row.remaining_days !== null
        ? row.remaining_days < 0 ? `${-row.remaining_days} days overdue` : `${row.remaining_days} days to go`
        : null;

  // items that aren't already shown in the sections above
  const otherItems = items.filter((i) => i.kind !== "service" && i.kind !== "compliance" && i.kind !== "breakdown");

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="bg-gradient-to-br from-navy to-navy-900 px-5 pb-5 pt-6 text-white md:pt-7">
        <div className="flex items-start gap-3 pr-10">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Icon className="h-5 w-5 text-brand-light" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight tracking-tight">{row.name}</h2>
            <p className="mt-0.5 text-sm text-white/60">
              {[formatReg(row.registration_number), row.category, [extra.make, extra.model].filter(Boolean).join(" ")].filter((x) => x && x !== "—").join(" · ")}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone={o.tone} icon={false}>{o.label}</Badge>
          <Badge tone={s.tone}>Service: {s.label}</Badge>
          <Badge tone={comp.overall.tone}>{comp.overall.label}</Badge>
        </div>
      </div>

      {/* Crew */}
      <Section title={row.asset_class === "machinery" || row.asset_class === "equipment" ? "Operators" : "Crew"} icon={UserRound}
        right={canEdit && (!extra.driver_name || !extra.co_driver_name) ? (
          <Link href={`/assets/${row.id}/edit`} className="text-xs font-medium text-navy hover:underline">Add names</Link>
        ) : undefined}>
        <dl className="grid grid-cols-2 gap-3">
          {[[crew.main, extra.driver_name], [crew.second, extra.co_driver_name]].map(([label, name]) => (
            <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-200/70">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
              <dd className={cn("mt-0.5 truncate text-sm font-semibold", name ? "text-slate-900" : "font-normal italic text-slate-400")}>{name || "Not assigned"}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Next service */}
      <Section title="Next service" icon={Wrench}>
        {!row.has_plan || (row.next_due_meter === null && row.next_due_date === null) ? (
          <p className="text-sm text-slate-600">
            No service plan yet.{" "}
            {canEdit && <Link href={`/assets/${row.id}#plan`} className="font-medium text-navy underline">Set it up</Link>}
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xl font-semibold tabular text-slate-900">
                  {row.next_due_meter !== null ? formatMeter(row.next_due_meter, row.meter_type) : formatDate(row.next_due_date)}
                </p>
                {row.next_due_meter !== null && row.next_due_date && <p className="text-xs text-slate-500">or by {formatDate(row.next_due_date)}</p>}
              </div>
              {remaining && <p className={cn("text-right text-sm font-semibold tabular", TONE_TEXT[s.tone])}>{remaining}</p>}
            </div>
            {progress !== null && <div className="mt-3"><ProgressMeter percent={progress} tone={s.tone} /></div>}
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              {hasMeter && (
                <>
                  <dt className="text-slate-500">Current reading</dt>
                  <dd className="text-right font-medium tabular">
                    {formatMeter(row.current_reading, row.meter_type)}
                    <span className={cn("block text-xs font-normal", row.reading_stale ? "text-amber-600" : "text-slate-400")}>
                      {row.current_reading === null ? "" : row.reading_at ? daysAgo(row.reading_age_days) : "date unknown"}
                    </span>
                  </dd>
                </>
              )}
              <dt className="text-slate-500">Last service</dt>
              <dd className="text-right font-medium">
                {lastService ? formatDate(lastService.service_date) : row.last_service_date ? formatDate(row.last_service_date) : "—"}
                {lastService && (lastService.service_type || lastService.cost > 0) && (
                  <span className="block text-xs font-normal text-slate-400">
                    {[lastService.service_type, lastService.cost > 0 ? formatKES(lastService.cost) : null].filter(Boolean).join(" · ")}
                  </span>
                )}
              </dd>
              {row.interval_meter && (
                <>
                  <dt className="text-slate-500">Interval</dt>
                  <dd className="text-right font-medium tabular">every {formatNumber(row.interval_meter)} {unit}</dd>
                </>
              )}
            </dl>
          </>
        )}
      </Section>

      {/* Compliance */}
      <Section title="Compliance" icon={comp.overall.tone === "green" ? ShieldCheck : ShieldAlert}
        right={canEdit ? <Link href={`/compliance/new?asset=${row.id}`} className="text-xs font-medium text-navy hover:underline">Add document</Link> : undefined}>
        <ul className="space-y-2">
          {comp.required.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 ring-1 ring-inset ring-slate-200/70">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{r.label}</p>
                <p className={cn("text-xs", r.state === "expired" ? "text-red-600" : r.state === "missing" ? "italic text-slate-400" : "text-slate-500")}>{docLine(r.state, r.doc)}</p>
              </div>
              {r.doc && r.state !== "expired" && r.state !== "expiring_soon"
                ? <Badge tone="green">OK</Badge>
                : r.doc
                  ? canEdit
                    ? <Link href={`/compliance/new?renew=${r.doc.id}`} className={cn(buttonClass.small, "shrink-0")}>Renew</Link>
                    : <Badge tone={DOC_TONE[r.state]}>{COMPLIANCE_STATUS[r.doc.status].label}</Badge>
                  : <Badge tone="slate" icon={false}>Missing</Badge>}
            </li>
          ))}
          {comp.others.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 text-sm">
              <span className="truncate text-slate-600">{d.document_type}</span>
              <span className={cn("shrink-0 text-xs", d.status === "expired" ? "font-medium text-red-600" : "text-slate-500")}>
                {d.status === "expired" ? "Expired" : "to"} {formatDate(d.expiry_date)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Open breakdowns */}
      {breakdowns.length > 0 && (
        <Section title="Open breakdown" icon={TriangleAlert}>
          <ul className="space-y-2">
            {breakdowns.map((b) => {
              const days = Math.floor(b.hours_down / 24);
              return (
                <li key={b.id}>
                  <Link href={`/breakdowns/${b.id}`} className="block rounded-xl bg-red-50/60 px-3 py-2.5 ring-1 ring-inset ring-red-600/15 transition hover:bg-red-50">
                    <p className="text-sm font-semibold text-red-700">
                      {b.breakdown_number} · {days >= 1 ? `${days} days down` : `${Math.round(b.hours_down)}h down`}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-700">{b.description}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Anything else flagged */}
      {otherItems.length > 0 && (
        <Section title="Also needs attention" icon={Gauge}>
          <ul className="space-y-1.5">
            {otherItems.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">{i.headline}</span>
                {i.metric && <span className="shrink-0 text-xs font-semibold tabular text-slate-500">{i.metric}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
        {canEdit && hasMeter && <Link href={`/assets/${row.id}#reading`} className={buttonClass.secondary}><Gauge className="h-4 w-4" /> <span className="sm:hidden">Reading</span><span className="hidden sm:inline">Update reading</span></Link>}
        {canEdit && row.has_plan && <Link href={`/assets/${row.id}#service`} className={buttonClass.secondary}><Wrench className="h-4 w-4" /> Mark serviced</Link>}
        <Link href={`/breakdowns/new?asset=${row.id}`} className={buttonClass.secondary}><TriangleAlert className="h-4 w-4" /> <span className="sm:hidden">Breakdown</span><span className="hidden sm:inline">Report breakdown</span></Link>
        <Link href={`/assets/${row.id}`} className={buttonClass.primary}>Full details <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
