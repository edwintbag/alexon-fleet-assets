import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { AssetForm } from "@/components/assets/asset-form";
import { ConfirmSubmit } from "@/components/form-bits";
import { updateAsset, archiveAsset } from "../../actions";

export const metadata = { title: "Edit asset" };

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("admin", "fleet");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: asset }, { data: users }, { data: cats }, { count }] = await Promise.all([
    supabase.from("assets").select("*").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    supabase.from("assets").select("category"),
    supabase.from("meter_readings").select("id", { count: "exact", head: true }).eq("asset_id", id),
  ]);
  if (!asset) notFound();
  const categories = [...new Set((cats ?? []).map((c) => c.category).filter(Boolean))].sort();
  return (
    <>
      <PageHeader title={`Edit ${asset.name}`} />
      <Card className="animate-rise p-4 sm:p-6">
        <AssetForm action={updateAsset} initial={asset} users={users ?? []} categories={categories} isNew={false} meterLocked={(count ?? 0) > 0} />
      </Card>
      {user.role === "admin" && (
        <Card className="mt-6 p-4 sm:p-6">
          <h2 className="font-semibold text-slate-900">Archive asset</h2>
          <p className="mb-3 text-sm text-slate-500">Removes it from lists and alerts. History is kept.</p>
          <form action={archiveAsset}>
            <input type="hidden" name="id" value={asset.id} />
            <ConfirmSubmit message="Archive this asset? It will disappear from lists and alerts." className="min-h-10 rounded-lg border border-red-300 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50">Archive asset</ConfirmSubmit>
          </form>
        </Card>
      )}
    </>
  );
}
