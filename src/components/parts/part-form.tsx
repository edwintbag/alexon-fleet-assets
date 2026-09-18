"use client";
import { useActionState } from "react";
import { savePart } from "@/app/(app)/parts/actions";
import { Field, cn, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { PART_UNITS } from "@/lib/status";

type Part = Record<string, unknown> & { id?: string };

export function PartForm({ part, suppliers, isNew }: { part?: Part; suppliers: { id: string; name: string }[]; isNew: boolean }) {
  const [state, action] = useActionState(savePart, null);
  const v = { ...(part ?? {}), ...(state?.values ?? {}) } as Record<string, unknown>;
  const val = (k: string) => (v[k] === null || v[k] === undefined ? "" : String(v[k]));
  return (
    <form action={action} className="space-y-4" key={state?.nonce ?? "part"}>
      <FormMessage state={state} />
      {part?.id && <input type="hidden" name="id" value={part.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Part name *" htmlFor="name"><input id="name" name="name" required defaultValue={val("name")} className={inputClass} /></Field>
        <Field label="Part number" htmlFor="part_number"><input id="part_number" name="part_number" defaultValue={val("part_number")} className={inputClass} /></Field>
        <Field label="Category" htmlFor="category" hint="e.g. Filters, Oils, Tyres"><input id="category" name="category" defaultValue={val("category")} className={inputClass} /></Field>
        <Field label="Unit" htmlFor="unit">
          <select id="unit" name="unit" defaultValue={val("unit") || "pcs"} className={inputClass}>
            {PART_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Minimum stock" htmlFor="minimum_stock" hint="Warn when stock falls to this level">
          <input id="minimum_stock" name="minimum_stock" inputMode="decimal" defaultValue={val("minimum_stock") || "0"} className={cn(inputClass, "tabular")} />
        </Field>
        <Field label="Reorder quantity" htmlFor="reorder_quantity" hint="How much to buy when low">
          <input id="reorder_quantity" name="reorder_quantity" inputMode="decimal" defaultValue={val("reorder_quantity")} className={cn(inputClass, "tabular")} />
        </Field>
        <Field label="Usual supplier" htmlFor="supplier_id">
          <select id="supplier_id" name="supplier_id" defaultValue={val("supplier_id")} className={inputClass}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Storage location" htmlFor="location" hint="e.g. Ugunja store, shelf B3"><input id="location" name="location" defaultValue={val("location")} className={inputClass} /></Field>
        {isNew && (
          <>
            <Field label="Opening stock" htmlFor="opening_stock" hint="What is on the shelf today">
              <input id="opening_stock" name="opening_stock" inputMode="decimal" defaultValue={val("opening_stock")} className={cn(inputClass, "tabular")} />
            </Field>
            <Field label="Unit cost (KES)" htmlFor="opening_cost">
              <input id="opening_cost" name="opening_cost" inputMode="decimal" defaultValue={val("opening_cost")} className={cn(inputClass, "tabular")} />
            </Field>
          </>
        )}
      </div>
      <Field label="Notes" htmlFor="notes"><textarea id="notes" name="notes" rows={2} defaultValue={val("notes")} className={inputClass} /></Field>
      <SubmitButton>{isNew ? "Add part" : "Save changes"}</SubmitButton>
    </form>
  );
}
