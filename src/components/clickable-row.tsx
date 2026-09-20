"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";

/**
 * A table row that opens `href` when clicked anywhere except on a real link
 * or button inside it — so the asset name can still go to its own page.
 */
export function ClickableRow({ href, className, selected, children }: {
  href: string; className?: string; selected?: boolean; children: ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button,input,select,label")) return;
        router.push(href, { scroll: false });
      }}
      className={cn("cursor-pointer transition-colors hover:bg-slate-50/70", selected && "bg-navy/5", className)}
    >
      {children}
    </tr>
  );
}
