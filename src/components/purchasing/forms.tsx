"use client";
import { useActionState, useState } from "react";
import { addItem, createPurchaseRequest, receiveItem } from "@/app/(app)/purchasing/actions";
import { Field, cn, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

type Part = { id: string; name: string; unit: string; reorder_quantity: number | null; current_stock: number; minimum_stock: number; average_cost: number };

export function NewRequestForm({ parts, suppliers, preselect }: {
  parts: Part[]; suppliers: { id: string; name: string }[]; preselect?: Part;
}) {
  const [state, action] = useActionState(createPurchaseRequest, null);
  const v = state?.values ?? {};
  const [partId, setPartId] = useState(v.spare_part_id ?? preselect?.id ?? "");
  const part = parts.find((p) => p.id === partId);
  const suggested = part ? (part.reorder_quantity ?? Math.max(part.minimum_stock * 2 - part.current_stock, 1)) : undefined;

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Spare part" htmlFor="spare_part_id" hint="Leave blank for something not in the parts list">
          <select id="spare_part_id" name="spare_part_id" value={partId} onChange={(e) => setPartId(e.target.value)} className={inputClass}>
            <option value="">— Not a stocked part —</option>
            {parts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.current_stock} {p.unit} left)</option>)}
          </select>
        </Field>
        <Field label="What is being bought? *" htmlFor="description">
          <input id="description" name="description" required key={partId} defaultValue={v.description ?? part?.name ?? ""} className={inputClass} />
        </Field>
        <Field label="Quantity *" htmlFor="quantity" hint={part ? `Suggested: ${suggested} ${part.unit}` : undefined}>
          <input id="quantity" name="quantity" inputMode="decimal" required key={`q-${partId}`} defaultValue={v.quantity ?? (suggested !== undefined ? String(suggested) : "")} className={cn(inputClass, "tabular")} />
        </Field>
        <Field label="Estimated unit cost (KES)" htmlFor="estimated_unit_cost">
          <input id="estimated_unit_cost" name="estimated_unit_cost" inputMode="decimal" key={`c-${partId}`} defaultValue={v.estimated_unit_cost ?? (part?.average_cost ? String(part.average_cost) : "")} className={cn(inputClass, "tabular")} />
        </Field>
        <Field label="Supplier" htmlFor="supplier_id">
          <select id="supplier_id" name="supplier_id" defaultValue={v.supplier_id ?? ""} className={inputClass}>
            <option value="">— Not chosen yet —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Needed by" htmlFor="needed_by">
          <input id="needed_by" name="needed_by" type="date" defaultValue={v.needed_by ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field label="Why is it needed?" htmlFor="justification">
        <textarea id="justification" name="justification" rows={2} defaultValue={v.justification ?? ""} className={inputClass} />
      </Field>
      <SubmitButton>Create request</SubmitButton>
    </form>
  );
}

export function AddItemForm({ requestId, parts }: { requestId: string; parts: Part[] }) {
  const [state, action] = useActionState(addItem, null);
  const [partId, setPartId] = useState("");
  const part = parts.find((p) => p.id === partId);
  return (
    <form action={action} className="space-y-3" key={state?.nonce ?? "add-item"}>
      <FormMessage state={state} />
      <input type="hidden" name="purchase_request_id" value={requestId} />
      <div className="grid gap-3 sm:grid-cols-4">
        <select name="spare_part_id" value={partId} onChange={(e) => setPartId(e.target.value)} className={inputClass} aria-label="Spare part">
          <option value="">— Not a stocked part —</option>
          {parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input name="description" required key={partId} defaultValue={part?.name ?? ""} placeholder="Description" className={inputClass} aria-label="Description" />
        <input name="quantity" inputMode="decimal" required placeholder="Qty" className={cn(inputClass, "tabular")} aria-label="Quantity" />
        <div className="flex gap-2">
          <input name="estimated_unit_cost" inputMode="decimal" placeholder="Unit cost" className={cn(inputClass, "tabular")} aria-label="Estimated unit cost" />
          <SubmitButton variant="secondary" pendingText="…">Add</SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function ReceiveForm({ itemId, requestId, outstanding, unit, lastCost }: {
  itemId: string; requestId: string; outstanding: number; unit: string; lastCost: number | null;
}) {
  const [state, action] = useActionState(receiveItem, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2" key={state?.nonce ?? itemId}>
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="purchase_request_id" value={requestId} />
      <input name="quantity" inputMode="decimal" defaultValue={String(outstanding)} className={cn(inputClass, "w-24 tabular")} aria-label={`Quantity received (${unit})`} />
      <input name="unit_cost" inputMode="decimal" defaultValue={lastCost ? String(lastCost) : ""} placeholder="Unit cost" className={cn(inputClass, "w-28 tabular")} aria-label="Unit cost" />
      <SubmitButton variant="secondary" pendingText="…">Receive</SubmitButton>
      {state?.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
      {state?.message && <span className="w-full text-xs text-emerald-600">{state.message}</span>}
    </form>
  );
}
