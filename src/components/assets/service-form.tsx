"use client";
import { useActionState } from "react";
import { completeService } from "@/app/(app)/assets/actions";
import { Field, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function ServiceForm({ assetId, unit, today, currentReading, hasMeter, lastServiceType }: {
  assetId: string; unit: string; today: string; currentReading: number | null; hasMeter: boolean; lastServiceType: string | null;
}) {
  const [state, action] = useActionState(completeService, null);
  const v = state?.values ?? {};
  return (
    <form action={action} className="space-y-3" key={state?.nonce ?? "service"}>
      <FormMessage state={state} />
      <input type="hidden" name="asset_id" value={assetId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Service date" htmlFor="service_date">
          <input id="service_date" name="service_date" type="date" max={today} required defaultValue={v.service_date ?? today} className={inputClass} />
        </Field>
        {hasMeter && (
          <Field label={`Reading at service (${unit})`} htmlFor="meter_at_service">
            <input id="meter_at_service" name="meter_at_service" inputMode="decimal" required defaultValue={v.meter_at_service ?? (currentReading ?? "").toString()} className={`${inputClass} tabular`} />
          </Field>
        )}
        <Field label="Service type" htmlFor="service_type">
          <input id="service_type" name="service_type" list="service-types" defaultValue={v.service_type ?? lastServiceType ?? ""} className={inputClass} />
          <datalist id="service-types"><option value="Minor Service" /><option value="Major Service" /></datalist>
        </Field>
        <Field label="Done by" htmlFor="performed_by" hint="In-house or garage name">
          <input id="performed_by" name="performed_by" defaultValue={v.performed_by ?? ""} className={inputClass} />
        </Field>
        <Field label="Total cost (KES)" htmlFor="cost">
          <input id="cost" name="cost" inputMode="decimal" defaultValue={v.cost ?? ""} className={`${inputClass} tabular`} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="svc-notes">
        <textarea id="svc-notes" name="notes" rows={2} defaultValue={v.notes ?? ""} className={inputClass} />
      </Field>
      <SubmitButton pendingText="Recording…">Mark service complete</SubmitButton>
    </form>
  );
}
