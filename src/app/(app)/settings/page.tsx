import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").single();
  return (
    <>
      <PageHeader title="Settings" subtitle="Rules that decide what needs attention" />
      <Card>
        <CardHeader title="Alert rules" />
        <div className="p-4 sm:p-5"><SettingsForm s={data ?? {}} /></div>
      </Card>
    </>
  );
}
