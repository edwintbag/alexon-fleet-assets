"use client";
import { useActionState, useId, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Scale } from "lucide-react";
import { recordMovement } from "@/app/(app)/parts/actions";
import { Field, cn, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

type Mode = "in" | "out" | "adjust";

export function MovementForm({ partId, unit, assets, canIssue }: {
  partId: string; unit: string; assets: { id: string; name: string }[]; canIssue: boolean;
}) {
  const [state, action] = useActionState(recordMovement, null);
  const [mode, setMode] = useState<Mode>("in");
  const key = useId();

  const tabs: { id: Mode; label: string; icon: typeof ArrowDownToLine; on: string }[] = [
    { id: "in", label: "Receive", icon: ArrowDownToLine, on: "border-emerald-300 bg-emerald-50 text-emerald-700" },
    { id: "out", label: "Issue", icon: ArrowUpFromLine, on: "border-sky-300 bg-sky-50 text-sky-700" },
    { id: "adjust", label: "Adjust", icon: Scale, on: "border-amber-300 bg-amber-50 text-amber-800" },
  ];

  const movementType = mode === "in" ? "purchase_receipt" : mode === "out" ? "service_issue" : "adjustment_out";

  return (
    <form action={action} className="space-y-3" key={`${state?.nonce ?? key}-${mode}`}>
      <FormMessage state={state} />
      <input type="hidden" name="part_id" value={partId} />

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setMode(t.id)}
            className={cn("flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-medium transition active:scale-[.98]",
              mode === t.id ? t.on : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {mode === "adjust" ? (
        <Field label="Adjustment type" htmlFor="movement_type">
          <select id="movement_type" name="movement_type" defaultValue="adjustment_out" className={inputClass}>
            <option value="adjustment_in">Found more than recorded (add)</option>
            <option value="adjustment_out">Found less than recorded (remove)</option>
            <option value="write_off">Damaged / expired (write off)</option>
          </select>
        </Field>
      ) : mode === "out" ? (
        <Field label="Used for" htmlFor="movement_type">
          <select id="movement_type" name="movement_type" defaultValue="service_issue" className={inputClass}>
            <option value="service_issue">Service</option>
            <option value="breakdown_issue">Breakdown repair</option>
            <option value="return_to_stock">Returning unused stock</option>
          </select>
        </Field>
      ) : (
        <input type="hidden" name="movement_type" value={movementType} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Quantity (${unit})`} htmlFor="quantity">
          <input id="quantity" name="quantity" inputMode="decimal" required className={cn(inputClass, "text-lg font-medium tabular")} />
        </Field>
        {mode === "in" && (
          <Field label="Unit cost (KES)" htmlFor="unit_cost" hint="Updates the average cost">
            <input id="unit_cost" name="unit_cost" inputMode="decimal" className={cn(inputClass, "tabular")} />
          </Field>
        )}
        {mode === "out" && canIssue && (
          <Field label="For which asset?" htmlFor="asset_id">
            <select id="asset_id" name="asset_id" className={inputClass}>
              <option value="">— Not specific —</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
      </div>

      {mode === "in" && <Field label="Reference" htmlFor="reference" hint="Invoice or delivery note"><input id="reference" name="reference" className={inputClass} /></Field>}
      {mode === "adjust" && <Field label="Reason *" htmlFor="reason" hint="Required — stock counts are audited"><input id="reason" name="reason" required className={inputClass} /></Field>}

      <SubmitButton variant={mode === "in" ? "primary" : "secondary"} className="w-full sm:w-auto">
        {mode === "in" ? "Add to stock" : mode === "out" ? "Take from stock" : "Save adjustment"}
      </SubmitButton>
    </form>
  );
}
