"use client";
import { useActionState, useState } from "react";
import { savePlan } from "@/app/(app)/purchasing/actions";
import { Field, cn, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

type Part = { id: string; name: string; unit: string; average_cost: number; supplier_id: string | null };
type Asset = { id: string; name: string; registration_number: string | null; asset_class: string };

export type PlanValues = {
  id?: string;
  name?: string;
  spare_part_id?: string | null;
  description?: string;
  quantity?: number;
  cycle_months?: number;
  estimated_unit_cost?: number | null;
  supplier_id?: string | null;
  asset_ids?: string[];
  next_due_date?: string;
  notes?: string | null;
};

const CYCLES: [number, string][] = [[1, "Every month"], [2, "Every 2 months"], [3, "Every 3 months"], [6, "Every 6 months"], [12, "Every year"]];

export function PlanForm({ plan, parts, suppliers, assets, today }: {
  plan?: PlanValues;
  parts: Part[];
  suppliers: { id: string; name: string }[];
  assets: Asset[];
  today: string;
}) {
  const [state, action] = useActionState(savePlan, null);
  const v = state?.values ?? {};
  const str = (k: keyof PlanValues, fallback = "") =>
    v[k as string] ?? (plan?.[k] === null || plan?.[k] === undefined ? fallback : String(plan[k]));

  const [partId, setPartId] = useState(str("spare_part_id"));
  const part = parts.find((p) => p.id === partId);
  const [chosen, setChosen] = useState<string[]>(plan?.asset_ids ?? []);
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const ordered = chosen.map((id) => assets.find((a) => a.id === id)).filter(Boolean) as Asset[];

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      {plan?.id && <input type="hidden" name="id" value={plan.id} />}
      {chosen.map((id) => <input key={id} type="hidden" name="asset_ids" value={id} />)}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan name *" htmlFor="name" hint='e.g. "Monthly tyres — Mguu Kumi & Mguu Sita"'>
          <input id="name" name="name" required defaultValue={str("name")} className={inputClass} />
        </Field>
        <Field label="Spare part" htmlFor="spare_part_id" hint="Optional — link it so receiving adds to stock">
          <select id="spare_part_id" name="spare_part_id" value={partId} onChange={(e) => setPartId(e.target.value)} className={inputClass}>
            <option value="">— Not a stocked part —</option>
            {parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="What is bought each time? *" htmlFor="description">
          <input id="description" name="description" required key={`d-${partId}`} defaultValue={str("description") || part?.name || ""} placeholder="e.g. Tyre 11R22.5" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity *" htmlFor="quantity">
            <input id="quantity" name="quantity" inputMode="decimal" required defaultValue={str("quantity", "1")} className={cn(inputClass, "tabular")} />
          </Field>
          <Field label="How often" htmlFor="cycle_months">
            <select id="cycle_months" name="cycle_months" defaultValue={str("cycle_months", "1")} className={inputClass}>
              {CYCLES.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Estimated unit cost (KES)" htmlFor="estimated_unit_cost">
          <input id="estimated_unit_cost" name="estimated_unit_cost" inputMode="decimal" key={`c-${partId}`}
            defaultValue={str("estimated_unit_cost") || (part?.average_cost ? String(part.average_cost) : "")} className={cn(inputClass, "tabular")} />
        </Field>
        <Field label="Supplier" htmlFor="supplier_id">
          <select id="supplier_id" name="supplier_id" key={`s-${partId}`} defaultValue={str("supplier_id") || part?.supplier_id || ""} className={inputClass}>
            <option value="">— Not chosen —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Next time to buy *" htmlFor="next_due_date">
          <input id="next_due_date" name="next_due_date" type="date" required defaultValue={str("next_due_date", today)} className={inputClass} />
        </Field>
      </div>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-slate-700">For which vehicles?</span>
        <p className="text-xs text-slate-500">Optional. If you pick more than one, they take turns in the order you tick them.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {assets.map((a) => {
            const on = chosen.includes(a.id);
            const turn = chosen.indexOf(a.id) + 1;
            return (
              <button key={a.id} type="button" onClick={() => toggle(a.id)} aria-pressed={on}
                className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition active:scale-[.98]",
                  on ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
                {on && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold tabular">{turn}</span>}
                {a.name}
              </button>
            );
          })}
        </div>
        {ordered.length > 1 && (
          <p className="pt-1 text-xs font-medium text-navy">Turns: {ordered.map((a) => a.name).join(" → ")} → back to the first</p>
        )}
      </div>

      <Field label="Notes" htmlFor="plan-notes">
        <textarea id="plan-notes" name="notes" rows={2} defaultValue={str("notes")} className={inputClass} />
      </Field>
      <SubmitButton>{plan?.id ? "Save plan" : "Add to buying plan"}</SubmitButton>
    </form>
  );
}
