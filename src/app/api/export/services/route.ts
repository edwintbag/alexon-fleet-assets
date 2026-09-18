import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const csv = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isActive) return new NextResponse("Unauthorised", { status: 401 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "1900-01-01";
  const to = url.searchParams.get("to") ?? "2999-12-31";

  const supabase = await createClient();
  const { data } = await supabase
    .from("service_records")
    .select("service_date, meter_at_service, service_type, performed_by, cost, notes, asset:assets(name, registration_number, meter_type)")
    .gte("service_date", from).lte("service_date", to)
    .order("service_date", { ascending: false });

  const header = ["Date", "Asset", "Registration", "Reading", "Unit", "Type", "Done by", "Cost KES", "Notes"];
  const lines = (data ?? []).map((r) => {
    const a = r.asset as unknown as { name: string; registration_number: string | null; meter_type: string } | null;
    return [r.service_date, a?.name, a?.registration_number, r.meter_at_service, a?.meter_type, r.service_type, r.performed_by, r.cost, r.notes].map(csv).join(",");
  });
  const body = "\uFEFF" + [header.join(","), ...lines].join("\r\n");
  return new NextResponse(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="services-${from}-to-${to}.csv"` },
  });
}
