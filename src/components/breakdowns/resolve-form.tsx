"use client";
import { useActionState } from "react";
import { resolveBreakdown } from "@/app/(app)/breakdowns/actions";
import { Field, cn, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function ResolveForm({ id }: { id: string }) {
  const [state, action] = useActionState(resolveBreakdown, null);
  const v = state?.values ?? {};
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <Field label="What was done? *" htmlFor="resolution">
        <textarea id="resolution" name="resolution" rows={2} required defaultValue={v.resolution ?? ""} className={inputClass} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Repair cost (KES)" htmlFor="repair_cost">
          <input id="repair_cost" name="repair_cost" inputMode="decimal" defaultValue={v.repair_cost ?? ""} className={cn(inputClass, "tabular")} />
        </Field>
        <Field label="Back in service?" htmlFor="back_in_service">
          <select id="back_in_service" name="back_in_service" defaultValue={v.back_in_service ?? "yes"} className={inputClass}>
            <option value="yes">Yes — mark asset operational</option>
            <option value="no">No — leave the asset as it is</option>
          </select>
        </Field>
      </div>
      <SubmitButton pendingText="Saving…">Mark resolved</SubmitButton>
    </form>
  );
}
