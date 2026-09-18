"use client";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import type { ActionState } from "@/lib/errors";
import { buttonClass, cn } from "@/components/ui";

export function SubmitButton({ children, variant = "primary", pendingText = "Saving…", className }: {
  children: React.ReactNode; variant?: keyof typeof buttonClass; pendingText?: string; className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={cn(buttonClass[variant], className)}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  const map = [
    { when: state.error, cls: "bg-red-50 text-red-700 ring-red-600/15", Icon: AlertCircle, text: state.error },
    { when: state.warning, cls: "bg-amber-50 text-amber-800 ring-amber-600/20", Icon: TriangleAlert, text: state.warning },
    { when: state.message, cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", Icon: CheckCircle2, text: state.message },
  ].find((m) => m.when);
  if (!map) return null;
  return (
    <p role={state.message ? "status" : "alert"} className={cn("animate-pop flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ring-1 ring-inset", map.cls)}>
      <map.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{map.text}</span>
    </p>
  );
}

export function ConfirmSubmit({ children, message, className }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}

/** Filters that apply as soon as you change them (no "Filter" button on mobile) */
export function AutoSubmit({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form
      className={className}
      onChange={(e) => {
        const t = e.target as HTMLElement;
        if (t.tagName === "SELECT") (e.currentTarget as HTMLFormElement).requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
