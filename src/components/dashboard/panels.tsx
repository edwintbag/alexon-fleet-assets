import Link from "next/link";
import { CalendarClock, Gauge, Package } from "lucide-react";
import type { AssetStatusRow, AttentionItem, ComplianceRow } from "@/lib/attention";
import type { AssetCard } from "@/lib/fleet-board";
import { cn } from "@/components/ui";

function Panel({ title, icon: Icon, right, children }: {
  title: string; icon: typeof Gauge; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)]">
      <p className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <Icon className="h-3.5 w-3.5 text-slate-400" /> {title}
        {right && <span className="ml-auto font-semibold normal-case tracking-normal text-slate-400">{right}</span>}
      </p>
      {children}
    </section>
  );
}

const DOT: Record<string, string> = {
  breakdown: "bg-red-500", overdue: "bg-red-500", expired: "bg-red-500",
  due: "bg-amber-400", expiring: "bg-amber-400", stale: "bg-amber-400",
  setup: "bg-slate-300", ok: "bg-emerald-400",
};

/** How many assets sit in each state, worst first. */
export function FleetStatusPanel({ cards }: { cards: AssetCard[] }) {
  const rows = cards.reduce<{ state: string; label: string; n: number }[]>((acc, c) => {
    const hit = acc.find((r) => r.state === c.state);
    if (hit) hit.n++;
    else acc.push({ state: c.state, label: c.label === "Off the road" ? "Breakdown" : c.label, n: 1 });
    return acc;
  }, []);

  return (
    <Panel title="Fleet status" icon={Gauge} right={`${cards.length} assets`}>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.state} className="flex items-center gap-2.5 px-4 py-2 text-sm">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[r.state])} aria-hidden />
            <span className="text-slate-700">{r.label}</span>
            <span className="ml-auto font-bold tabular text-slate-900">{r.n}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

type Upcoming = { key: string; name: string; what: string; days: number; href: string };

/** Services and documents falling due inside the next 30 days. */
export function Next30Panel({ assets, allDocs }: { assets: AssetStatusRow[]; allDocs: ComplianceRow[] }) {
  const list: Upcoming[] = [];

  for (const a of assets) {
    if (a.operational_status === "disposed" || a.archived_at) continue;
    if (a.remaining_days !== null && a.remaining_days >= 0 && a.remaining_days <= 30) {
      list.push({ key: `s-${a.id}`, name: a.name, what: "Service", days: a.remaining_days, href: `/assets/${a.id}` });
    }
  }
  for (const d of allDocs) {
    if (d.days_remaining >= 0 && d.days_remaining <= 30) {
      list.push({
        key: `d-${d.id}`, name: d.asset_name ?? "Company", what: d.document_type,
        days: d.days_remaining, href: "/compliance",
      });
    }
  }
  list.sort((x, y) => x.days - y.days);

  return (
    <Panel title="Next 30 days" icon={CalendarClock} right={String(list.length)}>
      {list.length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-500">Nothing falls due.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.slice(0, 7).map((u) => (
            <li key={u.key}>
              <Link href={u.href} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-slate-800">{u.name}</span>
                  <span className="ml-1.5 text-slate-500">{u.what}</span>
                </span>
                <span className={cn("shrink-0 tabular font-semibold", u.days <= 7 ? "text-amber-700" : "text-slate-500")}>
                  {u.days === 0 ? "today" : `${u.days}d`}
                </span>
              </Link>
            </li>
          ))}
          {list.length > 7 && <li className="px-4 py-2 text-xs text-slate-400">+{list.length - 7} more</li>}
        </ul>
      )}
    </Panel>
  );
}

/** Stores and purchasing items — they belong to no vehicle. */
export function StoresPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <Panel title="Stores & buying" icon={Package} right={String(items.length)}>
      <ul className="divide-y divide-slate-100">
        {items.slice(0, 6).map((i) => (
          <li key={i.key}>
            <Link href={i.action?.href ?? "/parts"} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-slate-800">{i.assetName}</span>
                <span className="ml-1.5 text-slate-500">{i.headline}</span>
              </span>
              {i.metric && <span className="shrink-0 tabular text-xs font-semibold text-slate-600">{i.metric}</span>}
            </Link>
          </li>
        ))}
        {items.length > 6 && <li className="px-4 py-2 text-xs text-slate-400">+{items.length - 6} more</li>}
      </ul>
    </Panel>
  );
}

