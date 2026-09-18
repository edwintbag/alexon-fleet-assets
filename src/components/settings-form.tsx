"use client";
import { useActionState } from "react";
import { saveSettings } from "@/app/(app)/settings/actions";
import { inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

type S = Record<string, number | string | boolean>;

function Num({ name, s }: { name: string; s: S }) {
  return <input name={name} inputMode="decimal" defaultValue={String(s[name])} className={`${inputClass} tabular`} aria-label={name} />;
}

export function SettingsForm({ s }: { s: S }) {
  const [state, action] = useActionState(saveSettings, null);
  const rows: [string, string, string][] = [
    ["Approaching", "approaching", "Early warning"],
    ["Due soon", "due_soon", "Plan the service"],
    ["Due", "due_window", "Service now"],
  ];
  return (
    <form action={action} className="space-y-6">
      <FormMessage state={state} />
      <div>
        <h3 className="mb-1 font-semibold text-slate-900">Service warning levels</h3>
        <p className="mb-3 text-sm text-slate-500">A service shows the status when the remaining amount is at or below the number.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">KM</th><th className="py-2 pr-3">Hours</th><th className="py-2">Days</th></tr>
            </thead>
            <tbody>
              {rows.map(([label, key, hint]) => (
                <tr key={key}>
                  <td className="py-1.5 pr-3"><span className="font-medium">{label}</span><div className="text-xs text-slate-500">{hint}</div></td>
                  <td className="py-1.5 pr-3"><Num name={`km_${key}`} s={s} /></td>
                  <td className="py-1.5 pr-3"><Num name={`hours_${key}`} s={s} /></td>
                  <td className="py-1.5"><Num name={`days_${key}`} s={s} /></td>
                </tr>
              ))}
              <tr>
                <td className="py-1.5 pr-3"><span className="font-medium">Overdue grace</span><div className="text-xs text-slate-500">0 = overdue as soon as passed</div></td>
                <td className="py-1.5 pr-3"><Num name="km_overdue_grace" s={s} /></td>
                <td className="py-1.5 pr-3"><Num name="hours_overdue_grace" s={s} /></td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Reading is old after (days)</span><Num name="stale_reading_days" s={s} /></label>
        <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Ask to confirm above (km per day)</span><Num name="max_km_per_day" s={s} /></label>
        <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Document warning (days before expiry)</span><Num name="compliance_warning_days" s={s} /></label>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-slate-900">Daily email (7:00 am)</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="digest_enabled" defaultChecked={Boolean(s.digest_enabled)} className="h-4 w-4" /> Send the daily attention email to Admin, Fleet and Management users</label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Extra recipients (comma-separated emails)</span>
          <input name="digest_extra_emails" defaultValue={String(s.digest_extra_emails ?? "")} className={inputClass} />
        </label>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-slate-900">Management reports</h3>
        <p className="text-sm text-slate-500">Summary emails to everyone with an Admin or Management account.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="weekly_report_enabled" defaultChecked={s.weekly_report_enabled !== false} className="h-4 w-4" /> Weekly summary every Monday morning</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="monthly_report_enabled" defaultChecked={s.monthly_report_enabled !== false} className="h-4 w-4" /> Monthly summary on the 1st</label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Extra report recipients (comma-separated)</span>
          <input name="report_extra_emails" defaultValue={String(s.report_extra_emails ?? "")} className={inputClass} />
        </label>
      </div>
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}
