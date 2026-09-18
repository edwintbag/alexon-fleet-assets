import Link from "next/link";
import type { ReactNode } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, Clock, EyeOff, Inbox } from "lucide-react";
import type { Tone } from "@/lib/status";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const TONES: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/30",
  orange: "bg-orange-50 text-orange-900 ring-orange-700/30",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export const TONE_TEXT: Record<Tone, string> = {
  green: "text-emerald-600", blue: "text-sky-600", amber: "text-amber-600",
  orange: "text-orange-700", red: "text-red-600", slate: "text-slate-500",
};

export const TONE_BAR: Record<Tone, string> = {
  green: "bg-emerald-500", blue: "bg-sky-500", amber: "bg-amber-500",
  orange: "bg-orange-600", red: "bg-red-600", slate: "bg-slate-300",
};

const TONE_ICON: Record<Tone, typeof CheckCircle2> = {
  green: CheckCircle2, blue: Clock, amber: AlertTriangle, orange: AlertTriangle, red: AlertOctagon, slate: EyeOff,
};

export function Badge({ tone, children, icon = true, size = "sm" }: { tone: Tone; children: ReactNode; icon?: boolean; size?: "sm" | "md" }) {
  const Icon = TONE_ICON[tone];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset",
      size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs",
      TONES[tone],
    )}>
      {icon ? <Icon className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden /> : <span className={cn("h-1.5 w-1.5 rounded-full", TONE_BAR[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)]", className)}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, right, icon: Icon }: { title: string; subtitle?: string; right?: ReactNode; icon?: typeof CheckCircle2 }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
      <div className="flex items-start gap-2.5">
        {Icon && <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-navy/5 text-navy"><Icon className="h-4 w-4" /></span>}
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 animate-rise">
      <div className="min-w-0">
        <h1 className="truncate text-[26px] font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const base = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-all duration-150 active:scale-[.98] disabled:opacity-60 disabled:active:scale-100";
export const buttonClass = {
  primary: `${base} bg-navy text-white shadow-sm hover:bg-navy-600 hover:shadow-[var(--shadow-lift)]`,
  accent: `${base} bg-brand text-white shadow-sm hover:bg-brand-dark hover:shadow-[var(--shadow-lift)]`,
  secondary: `${base} border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50`,
  ghost: `${base} text-slate-600 hover:bg-slate-100`,
  danger: `${base} border border-red-200 bg-white text-red-700 hover:bg-red-50`,
  small: "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[.98]",
};

export function LinkButton({ href, children, variant = "secondary", className }: { href: string; children: ReactNode; variant?: keyof typeof buttonClass; className?: string }) {
  return <Link href={href} className={cn(buttonClass[variant], className)}>{children}</Link>;
}

export const inputClass =
  "block w-full min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/10 disabled:bg-slate-50 disabled:text-slate-500";

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, children, icon: Icon = Inbox }: { title: string; children?: ReactNode; icon?: typeof Inbox }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center animate-fade">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Icon className="h-6 w-6" /></span>
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, tone = "slate", icon: Icon, href }: {
  label: string; value: ReactNode; sub?: string; tone?: Tone; icon?: typeof CheckCircle2; href?: string;
}) {
  const inner = (
    <div className={cn(
      "group relative h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-card)] transition-all duration-200",
      href && "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[var(--shadow-lift)]",
    )}>
      <span className={cn("absolute inset-x-0 top-0 h-1", TONE_BAR[tone])} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4 shrink-0", TONE_TEXT[tone])} aria-hidden />}
      </div>
      <p className={cn("mt-2 text-3xl font-semibold tabular leading-none", tone === "slate" ? "text-slate-900" : TONE_TEXT[tone])}>{value}</p>
      {sub && <p className="mt-1.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

/** Horizontal meter showing how much of a service interval is used */
export function ProgressMeter({ percent, tone, label }: { percent: number; tone: Tone; label?: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("bar-grow h-full rounded-full", TONE_BAR[tone])} style={{ width: `${p}%` }} />
        {p < 100 && <span className="absolute inset-y-0" style={{ left: `${p}%` }}><span className="block h-full w-px bg-white/70" /></span>}
      </div>
      {label && <p className="mt-1.5 text-xs text-slate-500">{label}</p>}
    </div>
  );
}

export function Divider({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
      <span className="h-px flex-1 bg-slate-200" />
      {children}
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
