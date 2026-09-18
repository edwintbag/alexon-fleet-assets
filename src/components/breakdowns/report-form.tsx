"use client";
import { useActionState, useState } from "react";
import { reportBreakdown } from "@/app/(app)/breakdowns/actions";
import { Field, cn, inputClass } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";

type Asset = { id: string; name: string; registration_number: string | null; meter_type: string };

export function ReportBreakdownForm({ assets, assetId }: { assets: Asset[]; assetId?: string }) {
  const [state, action] = useActionState(reportBreakdown, null);
  const v = state?.values ?? {};
  const [severity, setSeverity] = useState(v.severity ?? "major");
  const [operable, setOperable] = useState(v.asset_operable ?? "no");
  const [asset, setAsset] = useState(v.asset_id ?? assetId ?? "");
  const hasMeter = assets.find((a) => a.id === asset)?.meter_type !== "none";

  const choice = (name: string, value: string, current: string, set: (s: string) => void, label: string, tone: string) => (
    <button type="button" key={value} onClick={() => set(value)}
      className={cn("min-h-11 flex-1 rounded-xl border px-3 text-sm font-medium transition active:scale-[.98]",
        current === value ? tone : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
      {label}
    </button>
  );

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="severity" value={severity} />
      <input type="hidden" name="asset_operable" value={operable} />

      <Field label="Asset *" htmlFor="asset_id">
        <select id="asset_id" name="asset_id" required value={asset} onChange={(e) => setAsset(e.target.value)} className={inputClass}>
          <option value="">— Choose —</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.name}{a.registration_number ? ` (${a.registration_number})` : ""}</option>)}
        </select>
      </Field>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-slate-700">How bad is it?</span>
        <div className="flex gap-2">
          {choice("severity", "critical", severity, setSeverity, "Critical", "border-red-300 bg-red-50 text-red-700")}
          {choice("severity", "major", severity, setSeverity, "Major", "border-amber-300 bg-amber-50 text-amber-800")}
          {choice("severity", "minor", severity, setSeverity, "Minor", "border-slate-300 bg-slate-100 text-slate-700")}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-slate-700">Can it still be used?</span>
        <div className="flex gap-2">
          {choice("asset_operable", "yes", operable, setOperable, "Yes, still working", "border-emerald-300 bg-emerald-50 text-emerald-700")}
          {choice("asset_operable", "no", operable, setOperable, "No, off the road", "border-red-300 bg-red-50 text-red-700")}
        </div>
      </div>

      <Field label="What happened? *" htmlFor="description">
        <textarea id="description" name="description" rows={3} required defaultValue={v.description ?? ""} placeholder="e.g. Gearbox making noise and losing power on hills" className={inputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Where is it?" htmlFor="location">
          <input id="location" name="location" defaultValue={v.location ?? ""} placeholder="e.g. Ugunja yard, Kisumu road" className={inputClass} />
        </Field>
        {hasMeter && (
          <Field label="Current KM / hours" htmlFor="meter_reading" hint="Optional">
            <input id="meter_reading" name="meter_reading" inputMode="decimal" defaultValue={v.meter_reading ?? ""} className={cn(inputClass, "tabular")} />
          </Field>
        )}
      </div>

      <SubmitButton variant="accent" pendingText="Reporting…" className="w-full sm:w-auto">Report breakdown</SubmitButton>
    </form>
  );
}
