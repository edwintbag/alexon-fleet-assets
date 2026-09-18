"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Truck, FileCheck2, TriangleAlert, Package, ShoppingCart, BarChart3, Users, Settings, MoreHorizontal, type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui";

export type NavItem = { href: string; label: string; short: string; icon: LucideIcon; adminOnly?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/assets", label: "Fleet & Machinery", short: "Fleet", icon: Truck },
  { href: "/breakdowns", label: "Breakdowns", short: "Faults", icon: TriangleAlert },
  { href: "/compliance", label: "Compliance", short: "Docs", icon: FileCheck2 },
  { href: "/parts", label: "Spare parts", short: "Parts", icon: Package },
  { href: "/purchasing", label: "Purchasing", short: "Buying", icon: ShoppingCart },
  { href: "/reports", label: "Reports", short: "Reports", icon: BarChart3 },
  { href: "/users", label: "Users", short: "Users", icon: Users, adminOnly: true },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings, adminOnly: true },
];

const MOBILE_PRIMARY = ["/dashboard", "/assets", "/breakdowns", "/compliance"];

export function Nav({ isAdmin, variant, counts }: { isAdmin: boolean; variant: "side" | "bottom"; counts?: Record<string, number> }) {
  const path = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);
  const active = (href: string) => path === href || path.startsWith(href + "/");

  if (variant === "side") {
    return (
      <nav>
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">Menu</p>
        <ul className="space-y-0.5">
          {items.map((i) => {
            const on = active(i.href);
            return (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={on ? "page" : undefined}
                  className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    on ? "bg-white/12 text-white shadow-inner" : "text-white/70 hover:bg-white/8 hover:text-white")}
                >
                  {on && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-brand" aria-hidden />}
                  <i.icon className={cn("h-[18px] w-[18px] transition-transform group-hover:scale-110", on ? "text-brand-light" : "text-white/60")} />
                  <span className="truncate">{i.label}</span>
                  {counts?.[i.href] ? (
                    <span className="ml-auto rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white tabular">{counts[i.href]}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  const bottom = items.filter((i) => MOBILE_PRIMARY.includes(i.href));
  const moreCount = items.filter((i) => !MOBILE_PRIMARY.includes(i.href)).reduce((n, i) => n + (counts?.[i.href] ?? 0), 0);
  const moreActive = !bottom.some((i) => active(i.href));

  return (
    <nav className="bottom-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {bottom.map((i) => {
          const on = active(i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={on ? "page" : undefined} className="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium">
                <span className={cn("absolute top-0 h-0.5 w-8 rounded-full transition-opacity", on ? "bg-brand opacity-100" : "opacity-0")} aria-hidden />
                <span className="relative">
                  <i.icon className={cn("h-[22px] w-[22px] transition-transform", on ? "scale-110 text-navy" : "text-slate-400")} />
                  {counts?.[i.href] ? (
                    <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-white tabular">{counts[i.href]}</span>
                  ) : null}
                </span>
                <span className={on ? "text-navy" : "text-slate-500"}>{i.short}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/more" className="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium">
            <span className={cn("absolute top-0 h-0.5 w-8 rounded-full transition-opacity", moreActive ? "bg-brand opacity-100" : "opacity-0")} aria-hidden />
            <span className="relative">
              <MoreHorizontal className={cn("h-[22px] w-[22px]", moreActive ? "text-navy" : "text-slate-400")} />
              {moreCount ? <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-white tabular">{moreCount}</span> : null}
            </span>
            <span className={moreActive ? "text-navy" : "text-slate-500"}>More</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
