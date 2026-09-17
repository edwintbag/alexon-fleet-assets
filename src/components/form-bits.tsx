"use client";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/errors";
import { buttonClass } from "@/components/ui";

export function SubmitButton({ children, variant = "primary", pendingText = "Saving…" }: { children: React.ReactNode; variant?: keyof typeof buttonClass; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass[variant]}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state.warning) return <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{state.warning}</p>;
  if (state.message) return <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>;
  return null;
}

export function ConfirmSubmit({ children, message, className }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
