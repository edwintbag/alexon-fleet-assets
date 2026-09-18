"use client";
import { useActionState } from "react";
import { saveSupplier } from "@/app/(app)/parts/actions";
import { inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function SupplierForm() {
  const [state, action] = useActionState(saveSupplier, null);
  return (
    <form action={action} className="space-y-3" key={state?.nonce ?? "supplier"}>
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input name="name" required placeholder="Supplier name *" className={inputClass} aria-label="Supplier name" />
        <input name="contact_person" placeholder="Contact person" className={inputClass} aria-label="Contact person" />
        <input name="phone" placeholder="Phone" className={inputClass} aria-label="Phone" />
        <input name="email" type="email" placeholder="Email" className={inputClass} aria-label="Email" />
        <input name="supplies" placeholder="What they supply" className={inputClass} aria-label="What they supply" />
        <SubmitButton variant="secondary">Add supplier</SubmitButton>
      </div>
    </form>
  );
}
