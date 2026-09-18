import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { NewRequestForm } from "@/components/purchasing/forms";

export const metadata = { title: "New purchase request" };

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ part?: string }> }) {
  await requireRole("admin", "stores", "fleet");
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: parts }, { data: suppliers }] = await Promise.all([
    supabase.from("v_part_stock_status").select("id, name, unit, reorder_quantity, current_stock, minimum_stock, average_cost").order("name"),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
  ]);
  const list = (parts ?? []) as { id: string; name: string; unit: string; reorder_quantity: number | null; current_stock: number; minimum_stock: number; average_cost: number }[];
  return (
    <>
      <PageHeader title="New purchase request" subtitle="Add the first item now; you can add more before submitting." />
      <Card className="animate-rise p-4 sm:p-6">
        <NewRequestForm parts={list} suppliers={suppliers ?? []} preselect={list.find((p) => p.id === sp.part)} />
      </Card>
    </>
  );
}
