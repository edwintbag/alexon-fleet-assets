"use client";
import { useActionState } from "react";
import { uploadAssetFile } from "@/app/(app)/assets/actions";
import { inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function FileUpload({ assetId }: { assetId: string }) {
  const [state, action] = useActionState(uploadAssetFile, null);
  return (
    <form action={action} className="space-y-2.5" key={state?.nonce ?? "upload"}>
      <FormMessage state={state} />
      <input type="hidden" name="asset_id" value={assetId} />
      <input name="title" placeholder="What is it? e.g. Garage invoice March" className={inputClass} aria-label="File title" />
      <div className="grid gap-2 sm:grid-cols-2">
        <select name="kind" defaultValue="invoice" className={inputClass} aria-label="Document type">
          <option value="invoice">Invoice</option>
          <option value="job_card">Job card</option>
          <option value="quotation">Quotation</option>
          <option value="logbook">Logbook</option>
          <option value="photo">Photo</option>
          <option value="other">Other</option>
        </select>
        <input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className={`${inputClass} py-1.5`} aria-label="File" />
      </div>
      <SubmitButton variant="secondary" pendingText="Uploading…" className="w-full sm:w-auto">Upload</SubmitButton>
    </form>
  );
}
