import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { PartForm } from "@/components/parts/part-form";

export const metadata = { title: "Add part" };

export default async function NewPartPage() {
  await requireRole("admin", "stores");
  const supabase = await createClient();
  const { data: suppliers } = await supabase.from("suppliers").select("id, name").eq("is_active", true).order("name");
  return (
    <>
      <PageHeader title="Add spare part" subtitle="Set a minimum level and the system will warn you when stock runs low." />
      <Card className="animate-rise p-4 sm:p-6"><PartForm suppliers={suppliers ?? []} isNew /></Card>
    </>
  );
}
