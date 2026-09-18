"use client";
import { useActionState } from "react";
import { Mail } from "lucide-react";
import { emailReport } from "@/app/(app)/reports/actions";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function SendReport({ period }: { period: "week" | "month" }) {
  const [state, action] = useActionState(emailReport, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="period" value={period} />
      <SubmitButton variant="secondary" pendingText="Sending…"><Mail className="h-4 w-4" /> Email to management</SubmitButton>
      <div className="min-w-0 flex-1"><FormMessage state={state} /></div>
    </form>
  );
}
