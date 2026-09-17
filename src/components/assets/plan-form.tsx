"use client";
import { useActionState } from "react";
import { saveServicePlan } from "@/app/(app)/assets/actions";
import { Field, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

type Plan = {
  interval_meter: number | null; interval_days: number | null; last_service_meter: number | null;
  last_service_date: string | null; next_due_meter: number | null; next_due_date: string | null;
  schedule_anchor: string; service_type_note: string | null; estimated_cost: number | null;
} | null;

export function PlanForm({ assetId, unit, hasMeter, plan }: { assetId: string; unit: string; hasMeter: boolean; plan: Plan }) {
  const [state, action] = useActionState(saveServicePlan, null);
  const v = state?.values ?? {};
  const d = (k: string, fallback: unknown) => (v[k] ?? (fallback === null || fallback === undefined ? "" : String(fallback)));
  return (
    <form action={action} className="space-y-3" key={state?.nonce ?? "plan"}>
      <FormMessage state={state} />
      <input type="hidden" name="asset_id" value={assetId} />
      <div className="grid gap-3 sm:grid-cols-2">
        {hasMeter && (
          <Field label={`Service every (${unit})`} htmlFor="interval_meter">
            <input id="interval_meter" name="interval_meter" inputMode="decimal" defaultValue={d("interval_meter", plan?.interval_meter)} className={inputClass} />
          </Field>
        )}
        <Field label="…and/or every (days)" htmlFor="interval_days" hint="Optional time limit, e.g. 180">
          <input id="interval_days" name="interval_days" inputMode="numeric" defaultValue={d("interval_days", plan?.interval_days)} className={inputClass} />
        </Field>
        {hasMeter && (
          <Field label={`Last service reading (${unit})`} htmlFor="last_service_meter">
            <input id="last_service_meter" name="last_service_meter" inputMode="decimal" defaultValue={d("last_service_meter", plan?.last_service_meter)} className={inputClass} />
          </Field>
        )}
        <Field label="Last service date" htmlFor="last_service_date">
          <input id="last_service_date" name="last_service_date" type="date" defaultValue={d("last_service_date", plan?.last_service_date)} className={inputClass} />
        </Field>
        {hasMeter && (
          <Field label={`Next service at (${unit})`} htmlFor="next_due_meter" hint="Leave blank to calculate: last reading + interval">
            <input id="next_due_meter" name="next_due_meter" inputMode="decimal" defaultValue={d("next_due_meter", plan?.next_due_meter)} className={inputClass} />
          </Field>
        )}
        <Field label="Next service date" htmlFor="next_due_date" hint="Leave blank to calculate from days interval">
          <input id="next_due_date" name="next_due_date" type="date" defaultValue={d("next_due_date", plan?.next_due_date)} className={inputClass} />
        </Field>
        {hasMeter && (
          <Field label="After each service, schedule next from…" htmlFor="schedule_anchor">
            <select id="schedule_anchor" name="schedule_anchor" defaultValue={d("schedule_anchor", plan?.schedule_anchor ?? "actual")} className={inputClass}>
              <option value="actual">Actual service reading (e.g. 33,500 + 15,000)</option>
              <option value="planned">Planned marks (e.g. 500, 1,000, 1,500)</option>
            </select>
          </Field>
        )}
        <Field label="Service type / note" htmlFor="service_type_note">
          <input id="service_type_note" name="service_type_note" defaultValue={d("service_type_note", plan?.service_type_note)} className={inputClass} />
        </Field>
        <Field label="Estimated next service cost (KES)" htmlFor="estimated_cost">
          <input id="estimated_cost" name="estimated_cost" inputMode="decimal" defaultValue={d("estimated_cost", plan?.estimated_cost)} className={inputClass} />
        </Field>
      </div>
      <SubmitButton variant="secondary">Save service plan</SubmitButton>
    </form>
  );
}
