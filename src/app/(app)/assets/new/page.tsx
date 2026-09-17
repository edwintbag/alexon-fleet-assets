import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { AssetForm } from "@/components/assets/asset-form";
import { createAsset } from "../actions";

export const metadata = { title: "Add asset" };

export default async function NewAssetPage() {
  await requireRole("admin", "fleet");
  const supabase = await createClient();
  const [{ data: users }, { data: cats }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    supabase.from("assets").select("category"),
  ]);
  const categories = [...new Set((cats ?? []).map((c) => c.category).filter(Boolean))].sort();
  return (
    <>
      <PageHeader title="Add asset" subtitle="After saving you'll set up the service plan." />
      <Card className="p-4 sm:p-6">
        <AssetForm action={createAsset} initial={{}} users={users ?? []} categories={categories} isNew />
      </Card>
    </>
  );
}
