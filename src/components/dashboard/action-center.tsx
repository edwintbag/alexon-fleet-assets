import Link from "next/link";
import { AlertOctagon, AlertTriangle, CheckCircle2, FileCheck2, Gauge, Info, Settings2, TriangleAlert, Wrench, type LucideIcon } from "lucide-react";
import { CLASS_LABEL, classRank, type AttentionItem, type Priority } from "@/lib/attention";
import { EmptyState, buttonClass, cn } from "@/components/ui";

export const P_STYLE: Record<Priority, {
  label: string; when: string; icon: LucideIcon;
  text: string; bar: string; chip: string; ring: string; soft: string; metric: string;
}> = {
  critical: {
    label: "Critical", when: "Handle today", icon: AlertOctagon,
    text: "text-red-700", bar: "bg-red-500", chip: "bg-red-600 text-white",
    ring: "ring-red-600/15", soft: "bg-red-50", metric: "bg-red-600 text-white",
  },
  important: {
    label: "Important", when: "This week", icon: AlertTriangle,
    text: "text-amber-700", bar: "bg-amber-500", chip: "bg-amber-500 text-white",
    ring: "ring-amber-600/20", soft: "bg-amber-50", metric: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-600/20",
  },
  normal: {
    label: "Normal", when: "Keep an eye on", icon: Info,
    text: "text-sky-700", bar: "bg-sky-400", chip: "bg-sky-500 text-white",
    ring: "ring-sky-600/15", soft: "bg-sky-50", metric: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-300/60",
  },
};

const KIND_ICON: Record<AttentionItem["kind"], LucideIcon> = {
  service: Wrench, reading: Gauge, compliance: FileCheck2, breakdown: TriangleAlert, setup: Settings2,
};

function Row({ item, canAct }: { item: AttentionItem; canAct: boolean }) {
  const P = P_STYLE[item.priority];
  const Icon = KIND_ICON[item.kind];
  return (
    <div className="group relative">
      <div className="flex items-start gap-3 py-3.5 pl-4 pr-3 transition-colors hover:bg-slate-50/80 sm:items-center sm:gap-4 sm:pl-5 sm:pr-5">
        <span className={cn("absolute inset-y-0 left-0 w-[3px]", P.bar)} aria-hidden />
        <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset sm:mt-0", P.soft, P.ring, P.text)}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-1.5 text-[15px] leading-tight">
            {item.assetId ? (
              <Link href={`/assets/${item.assetId}`} className="font-semibold text-slate-900 underline-offset-2 hover:text-navy hover:underline">
                {item.assetName}
              </Link>
            ) : <span className="font-semibold text-slate-900">{item.assetName}</span>}
            {item.reg !== "—" && <span className="text-xs font-medium text-slate-400">{item.reg}</span>}
          </p>
          <p className={cn("mt-0.5 text-sm font-medium", P.text)}>{item.headline}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{item.detail}</p>

          {item.metric && (
            <span className={cn("mt-2 inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold tabular sm:hidden", P.metric)}>
              {item.metric}
            </span>
          )}
        </div>

        {item.metric && (
          <div className="hidden shrink-0 text-right sm:block">
            <span className={cn("inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-semibold tabular", P.metric)}>{item.metric}</span>
            {item.metricNote && <p className="mt-1 text-[11px] text-slate-400">{item.metricNote}</p>}
          </div>
        )}

        {item.action && canAct && (
          <Link href={item.action.href} className={cn(buttonClass.small, "hidden shrink-0 sm:inline-flex sm:opacity-70 sm:transition sm:group-hover:opacity-100")}>
            {item.action.label}
          </Link>
        )}
      </div>

      {item.action && canAct && (
        <div className="px-4 pb-3 sm:hidden">
          <Link href={item.action.href} className={cn(buttonClass.small, "w-full")}>{item.action.label}</Link>
        </div>
      )}
    </div>
  );
}

export function ActionGroups({ items, canAct }: { items: AttentionItem[]; canAct: boolean }) {
  const groups = (["critical", "important", "normal"] as Priority[])
    .map((p) => ({ p, rows: items.filter((i) => i.priority === p) }))
    .filter((g) => g.rows.length > 0);
  if (groups.length === 0) return null;

  return (
    <div className="divide-y divide-slate-100">
      {groups.map(({ p, rows }) => {
        const P = P_STYLE[p];
        return (
          <section key={p}>
            <div className="flex items-center justify-between gap-3 bg-slate-50/70 px-4 py-2 sm:px-5">
              <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular", P.chip)}>{rows.length}</span>
                {P.label}
              </h3>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{P.when}</span>
            </div>
            <ul className="stagger divide-y divide-slate-100">
              {rows.map((item, idx) => {
                const prev = rows[idx - 1];
                const newGroup = !prev || classRank(prev.assetClass) !== classRank(item.assetClass);
                const label = item.assetClass ? CLASS_LABEL[item.assetClass] ?? "Other assets" : "Stores & purchasing";
                return (
                  <li key={item.key}>
                    {newGroup && (
                      <p className="bg-white px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:px-5">
                        {label}
                      </p>
                    )}
                    <Row item={item} canAct={canAct} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function PriorityBar({ items }: { items: AttentionItem[] }) {
  const total = items.length;
  if (total === 0) return null;
  const parts = (["critical", "important", "normal"] as Priority[])
    .map((p) => ({ p, n: items.filter((i) => i.priority === p).length }))
    .filter((x) => x.n > 0);
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={parts.map((x) => `${x.n} ${x.p}`).join(", ")}>
      {parts.map(({ p, n }) => (
        <span key={p} className={cn("bar-grow h-full", P_STYLE[p].bar)} style={{ width: `${(n / total) * 100}%` }} />
      ))}
    </div>
  );
}

export function AllClear() {
  return (
    <EmptyState title="All clear" icon={CheckCircle2}>
      Every service, reading and document is up to date. The next thing due will appear here.
    </EmptyState>
  );
}
