"use client";
import { useActionState } from "react";
import { changePassword } from "@/app/(app)/account/actions";
import { Field, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, null);
  return (
    <form action={action} className="space-y-3" key={state?.nonce ?? "pw"}>
      <FormMessage state={state} />
      <Field label="New password" htmlFor="password"><input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className={inputClass} /></Field>
      <Field label="Confirm new password" htmlFor="confirm"><input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} className={inputClass} /></Field>
      <SubmitButton>Change password</SubmitButton>
    </form>
  );
}
