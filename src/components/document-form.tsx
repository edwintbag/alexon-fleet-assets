"use client";
import { useActionState } from "react";
import { saveDocument } from "@/app/(app)/compliance/actions";
import { Field, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { DOCUMENT_TYPES } from "@/lib/status";

export function DocumentForm({ assets, initial }: {
  assets: { id: string; name: string; registration_number: string | null }[];
  initial: Record<string, string>;
}) {
  const [state, action] = useActionState(saveDocument, null);
  const v = { ...initial, ...(state?.values ?? {}) };
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      {v.renew_id && <input type="hidden" name="renew_id" value={v.renew_id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Asset" htmlFor="asset_id" hint="Leave as company-wide for permits not tied to a vehicle">
          <select id="asset_id" name="asset_id" defaultValue={v.asset_id ?? ""} className={inputClass}>
            <option value="">— Company-wide —</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name}{a.registration_number ? ` (${a.registration_number})` : ""}</option>)}
          </select>
        </Field>
        <Field label="Document type *" htmlFor="document_type">
          <input id="document_type" name="document_type" list="doc-types" required defaultValue={v.document_type ?? ""} className={inputClass} />
          <datalist id="doc-types">{DOCUMENT_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
        <Field label="Document / policy number" htmlFor="document_number">
          <input id="document_number" name="document_number" defaultValue={v.document_number ?? ""} className={inputClass} />
        </Field>
        <Field label="Issued by" htmlFor="issuer" hint="Insurer, NTSA, county…">
          <input id="issuer" name="issuer" defaultValue={v.issuer ?? ""} className={inputClass} />
        </Field>
        <Field label="Issue date" htmlFor="issue_date">
          <input id="issue_date" name="issue_date" type="date" defaultValue={v.issue_date ?? ""} className={inputClass} />
        </Field>
        <Field label="Expiry date *" htmlFor="expiry_date" hint="The last day it is valid">
          <input id="expiry_date" name="expiry_date" type="date" required defaultValue={v.expiry_date ?? ""} className={inputClass} />
        </Field>
        <Field label="Cost (KES)" htmlFor="cost">
          <input id="cost" name="cost" inputMode="decimal" defaultValue={v.cost ?? ""} className={inputClass} />
        </Field>
        <Field label="Scan / photo (PDF, JPG, PNG — max 4 MB)" htmlFor="file">
          <input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={`${inputClass} py-1.5`} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="doc-notes">
        <textarea id="doc-notes" name="notes" rows={2} defaultValue={v.notes ?? ""} className={inputClass} />
      </Field>
      <SubmitButton pendingText="Uploading…">{v.renew_id ? "Save renewal" : "Save document"}</SubmitButton>
    </form>
  );
}
