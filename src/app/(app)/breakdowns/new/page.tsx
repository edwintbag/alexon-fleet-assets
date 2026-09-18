import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { ReportBreakdownForm } from "@/components/breakdowns/report-form";

export const metadata = { title: "Report breakdown" };

export default async function NewBreakdownPage({ searchParams }: { searchParams: Promise<{ asset?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: assets } = await supabase.from("assets").select("id, name, registration_number, meter_type").is("archived_at", null).order("name");
  return (
    <>
      <PageHeader title="Report breakdown" subtitle="Anyone can report. Fleet is alerted immediately." />
      <Card className="animate-rise p-4 sm:p-6">
        <ReportBreakdownForm assets={assets ?? []} assetId={sp.asset} />
      </Card>
    </>
  );
}
