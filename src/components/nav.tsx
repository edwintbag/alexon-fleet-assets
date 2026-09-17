"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Truck, FileCheck2, Users, Settings } from "lucide-react";
import { cn } from "@/components/ui";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

export function Nav({ isAdmin, variant }: { isAdmin: boolean; variant: "side" | "bottom" }) {
  const path = usePathname();
  const items: Item[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/assets", label: "Fleet", icon: Truck },
    { href: "/compliance", label: "Compliance", icon: FileCheck2 },
    ...(isAdmin
      ? [
          { href: "/users", label: "Users", icon: Users },
          { href: "/settings", label: "Settings", icon: Settings },
        ]
      : []),
  ];
  const active = (href: string) => path === href || path.startsWith(href + "/");

  if (variant === "side") return (
      <nav>
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                  active(i.href) ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
                )}
              >
                <i.icon className="h-4 w-4" />
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
  );
  return (
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active(i.href) ? "text-navy" : "text-slate-500")}
              >
                <i.icon className="h-5 w-5" />
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
  );
}
