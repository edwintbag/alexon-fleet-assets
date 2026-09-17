import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssetStatusRow } from "@/lib/attention";
import { SERVICE_STATUS, OPERATIONAL_STATUS } from "@/lib/status";
import { todayNairobi } from "@/lib/format";

const csv = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // avoid spreadsheet formula injection
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isActive) return new NextResponse("Unauthorised", { status: 401 });
  const supabase = await createClient();
  const { data } = await supabase.from("v_asset_service_status").select("*").is("archived_at", null).order("name");
  const rows = (data ?? []) as AssetStatusRow[];
  const header = ["Name", "Registration", "Category", "Meter", "Current reading", "Reading date", "Interval", "Last service reading", "Last service date", "Next service reading", "Next service date", "Remaining", "Service status", "Operational status"];
  const lines = rows.map((a) => [
    a.name, a.registration_number, a.category, a.meter_type, a.current_reading, a.reading_at?.slice(0, 10) ?? "",
    a.interval_meter, a.last_service_meter, a.last_service_date, a.next_due_meter, a.next_due_date, a.remaining_meter,
    SERVICE_STATUS[a.service_status].label, OPERATIONAL_STATUS[a.operational_status]?.label,
  ].map(csv).join(","));
  const body = "\uFEFF" + [header.join(","), ...lines].join("\r\n");
  return new NextResponse(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="fleet-status-${todayNairobi()}.csv"` },
  });
}
