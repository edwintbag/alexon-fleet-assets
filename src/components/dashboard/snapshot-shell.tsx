"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Overlay that holds the vehicle snapshot on the dashboard.
 * Desktop: panel slides in from the right. Phone: sheet slides up from the bottom.
 * Closes with Esc, the X, or a tap on the dimmed background.
 */
export function SnapshotShell({ closeHref, title, children }: { closeHref: string; title: string; children: React.ReactNode }) {
  const router = useRouter();
  const closeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [closeHref, router]);

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <Link href={closeHref} scroll={false} tabIndex={-1} aria-hidden
        className="animate-fade absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" />
      <div className="snapshot-panel bottom-safe absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl
                      md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[460px] md:rounded-none md:rounded-l-3xl">
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/30 md:hidden" aria-hidden />
        <Link ref={closeRef} href={closeHref} scroll={false} aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-900">
          <X className="h-4 w-4" />
        </Link>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
