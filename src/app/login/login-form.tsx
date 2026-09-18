"use client";
import { useActionState } from "react";
import { signIn } from "./actions";
import { Field, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4">
      {notice && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-600/20">{notice}</p>}
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <SubmitButton pendingText="Signing in…" className="w-full">Sign in</SubmitButton>
    </form>
  );
}
