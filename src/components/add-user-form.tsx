"use client";
import { useActionState } from "react";
import { addUser } from "@/app/(app)/users/actions";
import { Field, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function AddUserForm() {
  const [state, action] = useActionState(addUser, null);
  const v = state?.values ?? {};
  return (
    <form action={action} className="space-y-3" key={state?.nonce ?? "add-user"}>
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" htmlFor="full_name"><input id="full_name" name="full_name" required defaultValue={v.full_name ?? ""} className={inputClass} /></Field>
        <Field label="Email" htmlFor="email"><input id="email" name="email" type="email" required defaultValue={v.email ?? ""} className={inputClass} /></Field>
        <Field label="Role" htmlFor="role">
          <select id="role" name="role" defaultValue={v.role ?? "fleet"} className={inputClass}>
            <option value="fleet">Fleet / Logistics</option>
            <option value="stores">Stores / Procurement</option>
            <option value="management">Management (view only)</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Temporary password" htmlFor="password" hint="At least 10 characters. Share it privately.">
          <input id="password" name="password" type="text" required minLength={10} autoComplete="off" className={inputClass} />
        </Field>
      </div>
      <SubmitButton pendingText="Creating…">Create user</SubmitButton>
    </form>
  );
}
