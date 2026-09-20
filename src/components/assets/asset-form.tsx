"use client";
import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/errors";
import { Field, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export type AssetFormValues = {
  id?: string;
  name?: string;
  registration_number?: string | null;
  category?: string;
  asset_class?: string;
  make?: string | null;
  model?: string | null;
  meter_type?: string;
  operational_status?: string;
  responsible_user_id?: string | null;
  notes?: string | null;
  driver_name?: string | null;
  co_driver_name?: string | null;
};

export function AssetForm({
  action,
  initial,
  users,
  categories,
  isNew,
  meterLocked,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial: AssetFormValues;
  users: { id: string; full_name: string; email: string }[];
  categories: string[];
  isNew: boolean;
  meterLocked?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const v = { ...initial, ...(state?.values ?? {}) } as Record<string, string | null | undefined>;
  const val = (k: string) => (v[k] ?? "") as string;
  const [assetClass, setAssetClass] = useState(val("asset_class") || "vehicle");
  const isMachine = assetClass === "machinery" || assetClass === "equipment";

  return (
    <form action={formAction} className="space-y-5" key={JSON.stringify(state?.values ?? {})}>
      <FormMessage state={state} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *" htmlFor="name" hint='e.g. "Mguu Kumi — Sinotruck"'>
          <input id="name" name="name" required defaultValue={val("name")} className={inputClass} />
        </Field>
        <Field label="Registration / plate number" htmlFor="registration_number" hint="Leave blank for machines without plates">
          <input id="registration_number" name="registration_number" defaultValue={val("registration_number")} className={inputClass} autoCapitalize="characters" />
        </Field>
        <Field label="Category" htmlFor="category" hint="e.g. Truck, Pickup, Excavator">
          <input id="category" name="category" list="categories" defaultValue={val("category")} className={inputClass} />
          <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Class" htmlFor="asset_class">
          <select id="asset_class" name="asset_class" value={assetClass} onChange={(e) => setAssetClass(e.target.value)} className={inputClass}>
            <option value="vehicle">Vehicle</option>
            <option value="machinery">Machinery / plant</option>
            <option value="trailer">Trailer</option>
            <option value="equipment">Equipment</option>
          </select>
        </Field>
        <Field label="Make" htmlFor="make">
          <input id="make" name="make" defaultValue={val("make")} className={inputClass} />
        </Field>
        <Field label="Model" htmlFor="model">
          <input id="model" name="model" defaultValue={val("model")} className={inputClass} />
        </Field>
        <Field label="Meter" htmlFor="meter_type" hint={meterLocked ? "Locked because readings exist" : "What the service interval is measured in"}>
          {meterLocked && <input type="hidden" name="meter_type" value={val("meter_type")} />}
          <select id="meter_type" name={meterLocked ? undefined : "meter_type"} disabled={meterLocked} defaultValue={val("meter_type") || "km"} className={inputClass}>
            <option value="km">Kilometres (KM)</option>
            <option value="hours">Engine hours</option>
            <option value="none">No meter (date-based only)</option>
          </select>
        </Field>
        <Field label="Status" htmlFor="operational_status">
          <select id="operational_status" name="operational_status" defaultValue={val("operational_status") || "operational"} className={inputClass}>
            <option value="operational">Operational</option>
            <option value="under_maintenance">Under maintenance</option>
            <option value="breakdown">Breakdown</option>
            <option value="standby">Standby</option>
            <option value="disposed">Disposed</option>
          </select>
        </Field>
        <Field label="Responsible person" htmlFor="responsible_user_id">
          <select id="responsible_user_id" name="responsible_user_id" defaultValue={val("responsible_user_id")} className={inputClass}>
            <option value="">— Not assigned —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
          </select>
        </Field>
        <Field label={isMachine ? "Operator" : "Driver"} htmlFor="driver_name">
          <input id="driver_name" name="driver_name" defaultValue={val("driver_name")} autoComplete="off" className={inputClass} />
        </Field>
        <Field label={isMachine ? "Assistant operator" : "Co-driver"} htmlFor="co_driver_name">
          <input id="co_driver_name" name="co_driver_name" defaultValue={val("co_driver_name")} autoComplete="off" className={inputClass} />
        </Field>
        {isNew && (
          <Field label="Current KM / hours (optional)" htmlFor="initial_reading" hint="You can add it later">
            <input id="initial_reading" name="initial_reading" inputMode="decimal" defaultValue={val("initial_reading")} className={inputClass} />
          </Field>
        )}
      </div>
      <Field label="Notes" htmlFor="notes">
        <textarea id="notes" name="notes" rows={3} defaultValue={val("notes")} className={inputClass} />
      </Field>
      <SubmitButton>{isNew ? "Create asset" : "Save changes"}</SubmitButton>
    </form>
  );
}
