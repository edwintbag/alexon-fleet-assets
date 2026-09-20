import Link from "next/link";
import { AlertOctagon, CheckCircle2, ChevronRight } from "lucide-react";
import type { AttentionItem, Priority } from "@/lib/attention";
import { CLASS_LABEL } from "@/lib/attention";
import type { AssetCard, Fact } from "@/lib/fleet-board";
import { cn } from "@/components/ui";
import type { Tone } from "@/lib/status";

const CARD: Record<Tone, { edge: string; bg: string; chip: string }> = {
  red:    { edge: "bg-red-500",     bg: "bg-red-50/70 hover:bg-red-50",         chip: "bg-red-600 text-white" },
  orange: { edge: "bg-orange-500",  bg: "bg-orange-50/70 hover:bg-orange-50",   chip: "bg-orange-600 text-white" },
  amber:  { edge: "bg-amber-400",   bg: "bg-amber-50/70 hover:bg-amber-50",     chip: "bg-amber-500 text-white" },
  blue:   { edge: "bg-sky-400",     bg: "bg-sky-50/70 hover:bg-sky-50",         chip: "bg-sky-500 text-white" },
  green:  { edge: "bg-emerald-400", bg: "bg-emerald-50/60 hover:bg-emerald-50", chip: "bg-emerald-600 text-white" },
  slate:  { edge: "bg-slate-300",   bg: "bg-slate-50 hover:bg-slate-100/80",    chip: "bg-slate-500 text-white" },
};

const FACT_TONE: Record<string, string> = { red: "text-red-700", amber: "text-amber-700", slate: "text-slate-400" };

/** The urgency chips under the greeting. */
export const P_STYLE: Record<Priority, { label: string; chip: string }> = {
  critical:  { label: "Critical",  chip: "bg-red-600 text-white" },
  important: { label: "Important", chip: "bg-amber-500 text-white" },
  normal:    { label: "Normal",    chip: "bg-sky-500 text-white" },
};

function FactList({ facts }: { facts: Fact[] }) {
  return (
    <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px]">
      {facts.map((f) => (
        <div key={f.label} className="flex items-baseline gap-1.5">
          <dt className="text-slate-500">{f.label}</dt>
          <dd className={cn("font-semibold tabular text-slate-800", f.tone && FACT_TONE[f.tone], f.warn && "text-amber-700")}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AssetRow({ card, selected }: { card: AssetCard; selected: boolean }) {
  const c = CARD[card.tone];
  return (
    <Link href={card.href} scroll={false}
      className={cn("group relative flex items-center gap-3 overflow-hidden rounded-xl pl-4 pr-3 py-2.5 transition",
        c.bg, selected && "ring-2 ring-navy/30")}>
      <span className={cn("absolute inset-y-0 left-0 w-1.5", c.edge)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-slate-900">{card.name}</span>
          {card.reg && <span className="text-xs font-medium text-slate-500">{card.reg}</span>}
        </p>
        <FactList facts={card.facts} />
      </div>
      <span className={cn("shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold", c.chip)}>{card.label}</span>
      <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 sm:block" aria-hidden />
    </Link>
  );
}

/** Critical strip: the same asset may also appear in the board below. */
export function CriticalStrip({ items, canAct }: { items: AttentionItem[]; canAct: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-red-200 bg-red-50/60">
      <p className="flex items-center gap-2 border-b border-red-200/70 bg-red-100/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-red-700">
        <AlertOctagon className="h-3.5 w-3.5" /> Critical · handle today
        <span className="ml-auto rounded-full bg-red-600 px-2 text-[11px] text-white tabular">{items.length}</span>
      </p>
      <ul className="divide-y divide-red-200/60">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                <span className="font-semibold text-slate-900">{i.assetName}</span>
                {i.reg !== "—" && <span className="ml-1.5 text-xs text-slate-500">{i.reg}</span>}
                <span className="ml-2 font-medium text-red-700">{i.headline}</span>
              </p>
            </div>
            {i.metric && <span className="shrink-0 rounded-lg bg-red-600 px-2 py-0.5 text-xs font-bold text-white tabular">{i.metric}</span>}
            {i.action && canAct && (
              <Link href={i.action.href} className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100">
                {i.action.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Asset board: problems first, healthy assets folded away. */
export function FleetBoard({ cards, selectedId }: { cards: AssetCard[]; selectedId?: string | null }) {
  const attention = cards.filter((c) => c.state !== "ok");
  const ok = cards.filter((c) => c.state === "ok");

  const groups = attention.reduce<{ label: string; rows: AssetCard[] }[]>((acc, c) => {
    const label = CLASS_LABEL[c.assetClass] ?? "Other";
    const hit = acc.find((g) => g.label === label);
    if (hit) hit.rows.push(c);
    else acc.push({ label, rows: [c] });
    return acc;
  }, []);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.label}>
          <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.label} ({g.rows.length})</p>
          <ul className="stagger space-y-2">
            {g.rows.map((c) => <li key={c.id}><AssetRow card={c} selected={c.id === selectedId} /></li>)}
          </ul>
        </section>
      ))}

      {ok.length > 0 && (
        <details className="group rounded-2xl border border-emerald-200/70 bg-emerald-50/40 open:bg-white" open={attention.length === 0}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            All OK
            <span className="rounded-full bg-emerald-600 px-2 text-[11px] font-bold text-white tabular">{ok.length}</span>
            <ChevronRight className="ml-auto h-4 w-4 transition group-open:rotate-90" aria-hidden />
          </summary>
          <ul className="space-y-2 px-2 pb-3">
            {ok.map((c) => <li key={c.id}><AssetRow card={c} selected={c.id === selectedId} /></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
