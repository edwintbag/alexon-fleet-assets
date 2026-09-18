"use client";
import { useActionState, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { recordReading } from "@/app/(app)/assets/actions";
import { Badge, Field, cn, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { SERVICE_STATUS, type ServiceStatus } from "@/lib/status";

export type Thresholds = { approaching: number; due_soon: number; due_window: number; grace: number };

function classify(remaining: number, t: Thresholds): ServiceStatus {
  if (remaining < -t.grace) return "overdue";
  if (remaining <= t.due_window) return "due";
  if (remaining <= t.due_soon) return "due_soon";
  if (remaining <= t.approaching) return "approaching";
  return "normal";
}

const fmt = (n: number) => n.toLocaleString("en-KE", { maximumFractionDigits: 1 });

export function ReadingForm({ assetId, unit, isAdmin, currentReading, nextDue, thresholds }: {
  assetId: string; unit: string; isAdmin: boolean;
  currentReading: number | null; nextDue: number | null; thresholds: Thresholds;
}) {
  const [state, action] = useActionState(recordReading, null);
  const [typed, setTyped] = useState("");
  const needsConfirm = state?.values?.needs_confirm === "1";

  const value = Number(typed.replace(/,/g, "").replace(/[^\d.]/g, ""));
  const valid = typed.trim() !== "" && Number.isFinite(value) && value >= 0;
  const delta = valid && currentReading !== null ? value - currentReading : null;
  const remaining = valid && nextDue !== null ? nextDue - value : null;
  const status = remaining !== null ? classify(remaining, thresholds) : null;

  return (
    <form action={action} className="space-y-3" key={state?.nonce ?? "reading"}>
      <FormMessage state={state} />
      <input type="hidden" name="asset_id" value={assetId} />
      {needsConfirm && <input type="hidden" name="confirmed" value="1" />}

      <Field label={`New reading (${unit})`} htmlFor="reading">
        <input
          id="reading" name="reading" inputMode="decimal" required autoComplete="off"
          defaultValue={state?.values?.reading ?? ""}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="e.g. 33,117"
          className={cn(inputClass, "text-lg font-medium tabular")}
        />
      </Field>

      {valid && (delta !== null || remaining !== null) && (
        <div className="animate-fade rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
          {delta !== null && (
            <p className={cn("flex items-center gap-1.5 font-medium", delta < 0 ? "text-red-600" : "text-slate-700")}>
              <ArrowUpRight className={cn("h-4 w-4", delta < 0 && "rotate-90")} aria-hidden />
              {delta < 0 ? `${fmt(delta)} ${unit} — lower than the current reading` : `+${fmt(delta)} ${unit} since last reading`}
            </p>
          )}
          {remaining !== null && status && (
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-slate-600">
              <span>{remaining < 0 ? `${fmt(-remaining)} ${unit} past due` : `${fmt(remaining)} ${unit} to next service`}</span>
              <Badge tone={SERVICE_STATUS[status].tone}>{SERVICE_STATUS[status].label}</Badge>
            </p>
          )}
        </div>
      )}

      {isAdmin && (
        <Field label="Note / correction reason" htmlFor="note" hint="Only needed when correcting a wrong reading downwards">
          <input id="note" name="note" defaultValue={state?.values?.note ?? ""} className={inputClass} />
        </Field>
      )}
      <SubmitButton variant={needsConfirm ? "accent" : "primary"} className="w-full sm:w-auto">
        {needsConfirm ? "Yes, the reading is correct" : "Save reading"}
      </SubmitButton>
    </form>
  );
}
