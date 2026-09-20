import type { AssetStatusRow, AttentionItem, BreakdownRow, ComplianceRow } from "@/lib/attention";
import { complianceSummary } from "@/lib/compliance";
import { classRank } from "@/lib/attention";
import type { Tone } from "@/lib/status";
import { formatNumber, unitFor } from "@/lib/format";

/** One line on a card: a short label and the number that matters. */
export type Fact = { label: string; value: string; tone?: Tone; warn?: boolean };

export type AssetCard = {
  id: string;
  name: string;
  reg: string;
  category: string;
  assetClass: string;
  /** worst thing going on, drives colour and sort */
  state: "breakdown" | "overdue" | "due" | "expired" | "expiring" | "stale" | "setup" | "ok";
  label: string;          // e.g. "Service overdue"
  tone: Tone;
  rank: number;           // 0 = worst
  facts: Fact[];          // reading · service · compliance
  href: string;
};

const STATE: Record<AssetCard["state"], { label: string; tone: Tone; rank: number }> = {
  breakdown: { label: "Breakdown", tone: "red", rank: 0 },
  overdue:   { label: "Service overdue", tone: "red", rank: 1 },
  expired:   { label: "Document expired", tone: "red", rank: 2 },
  due:       { label: "Service due", tone: "amber", rank: 3 },
  expiring:  { label: "Document expiring", tone: "amber", rank: 4 },
  stale:     { label: "Reading old", tone: "amber", rank: 5 },
  setup:     { label: "Needs setup", tone: "slate", rank: 6 },
  ok:        { label: "OK", tone: "green", rank: 7 },
};

function serviceFact(a: AssetStatusRow): Fact {
  const u = unitFor(a.meter_type);
  if (a.remaining_meter !== null) {
    return a.remaining_meter < 0
      ? { label: "Service", value: `${formatNumber(-a.remaining_meter)} ${u} over`, tone: "red" }
      : { label: "Service", value: `${formatNumber(a.remaining_meter)} ${u} left`, tone: a.service_status === "due" || a.service_status === "due_soon" ? "amber" : undefined };
  }
  if (a.remaining_days !== null) {
    return a.remaining_days < 0
      ? { label: "Service", value: `${-a.remaining_days} days over`, tone: "red" }
      : { label: "Service", value: `in ${a.remaining_days} days`, tone: a.remaining_days <= 14 ? "amber" : undefined };
  }
  return { label: "Service", value: "not set", tone: "slate" };
}

function readingFact(a: AssetStatusRow): Fact {
  const u = unitFor(a.meter_type);
  if (a.meter_type === "none") return { label: "Reading", value: "no meter", tone: "slate" };
  if (a.current_reading === null) return { label: "Reading", value: "none yet", tone: "slate" };
  const age = a.reading_at ? (a.reading_age_days ?? 0) : null;
  const when = age === null ? "undated" : age === 0 ? "today" : age === 1 ? "1 day" : `${age} days`;
  return { label: "Reading", value: `${formatNumber(a.current_reading)} ${u} · ${when}`, warn: a.reading_stale };
}

function complianceFact(a: AssetStatusRow, docs: ComplianceRow[]): Fact {
  const c = complianceSummary(a.asset_class, docs);
  const worst = c.required.reduce<{ state: string; days: number | null }>((w, r) => {
    const days = r.doc ? r.doc.days_remaining : null;
    if (r.state === "missing") return w.state === "expired" ? w : { state: "missing", days: null };
    if (r.state === "expired") return { state: "expired", days };
    if (w.state === "expired" || w.state === "missing") return w;
    return days !== null && (w.days === null || days < w.days) ? { state: r.state, days } : w;
  }, { state: "valid", days: null });

  if (worst.state === "missing") return { label: "Papers", value: "missing", tone: "slate" };
  if (worst.state === "expired") return { label: "Papers", value: `${Math.abs(worst.days ?? 0)} days over`, tone: "red" };
  if (worst.days === null) return { label: "Papers", value: "—", tone: "slate" };
  return { label: "Papers", value: `${worst.days} days`, tone: worst.state === "expiring_soon" ? "amber" : undefined };
}

/** One card per asset: its worst state plus three numbers. */
export function buildAssetCards(
  assets: AssetStatusRow[],
  allDocs: ComplianceRow[],
  breakdowns: BreakdownRow[],
): AssetCard[] {
  return assets
    .filter((a) => a.operational_status !== "disposed" && !a.archived_at)
    .map((a) => {
      const docs = allDocs.filter((d) => d.asset_id === a.id);
      const comp = complianceSummary(a.asset_class, docs);
      const open = breakdowns.filter((b) => b.asset_id === a.id);
      const needsSetup = !a.has_plan || (a.next_due_meter === null && a.next_due_date === null) || (a.meter_type !== "none" && a.current_reading === null);

      const state: AssetCard["state"] =
        open.length > 0 || a.operational_status === "breakdown" ? "breakdown"
        : a.service_status === "overdue" ? "overdue"
        : comp.overall.label === "Not compliant" ? "expired"
        : a.service_status === "due" || a.service_status === "due_soon" ? "due"
        : comp.required.some((r) => r.state === "expiring_soon") ? "expiring"
        : needsSetup ? "setup"
        : a.meter_type !== "none" && a.reading_stale ? "stale"
        : "ok";

      const meta = STATE[state];
      return {
        id: a.id,
        name: a.name,
        reg: a.registration_number ?? "",
        category: a.category,
        assetClass: a.asset_class,
        state,
        label: state === "breakdown" && open.length === 0 ? "Off the road" : meta.label,
        tone: meta.tone,
        rank: meta.rank,
        facts: [readingFact(a), serviceFact(a), complianceFact(a, docs)],
        href: `/dashboard?asset=${a.id}`,
      };
    })
    // grouped by class on screen, worst first inside each group
    .sort((x, y) => classRank(x.assetClass) - classRank(y.assetClass) || x.rank - y.rank || x.name.localeCompare(y.name));
}

/** Critical items shown above the board; an asset may appear here and in the list below. */
export function criticalItems(items: AttentionItem[]): AttentionItem[] {
  return items.filter((i) => i.priority === "critical");
}
