"use client";
import { useActionState } from "react";
import { recordReading } from "@/app/(app)/assets/actions";
import { Field, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function ReadingForm({ assetId, unit, isAdmin }: { assetId: string; unit: string; isAdmin: boolean }) {
  const [state, action] = useActionState(recordReading, null);
  const needsConfirm = state?.values?.needs_confirm === "1";
  return (
    <form action={action} className="space-y-3" key={state?.nonce ?? "reading"}>
      <FormMessage state={state} />
      <input type="hidden" name="asset_id" value={assetId} />
      {needsConfirm && <input type="hidden" name="confirmed" value="1" />}
      <Field label={`New reading (${unit})`} htmlFor="reading">
        <input
          id="reading" name="reading" inputMode="decimal" required autoComplete="off"
          defaultValue={state?.values?.reading ?? ""} placeholder="e.g. 33,117"
          className={`${inputClass} text-lg tabular`}
        />
      </Field>
      {isAdmin && (
        <Field label="Note / correction reason" htmlFor="note" hint="Required only if you are correcting a wrong (higher) reading downwards">
          <input id="note" name="note" defaultValue={state?.values?.note ?? ""} className={inputClass} />
        </Field>
      )}
      <SubmitButton variant={needsConfirm ? "accent" : "primary"}>{needsConfirm ? "Yes, the reading is correct" : "Save reading"}</SubmitButton>
    </form>
  );
}
