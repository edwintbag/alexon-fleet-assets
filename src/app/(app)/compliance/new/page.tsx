import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { DocumentForm } from "@/components/document-form";

export const metadata = { title: "Add document" };

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ asset?: string; renew?: string }> }) {
  await requireRole("admin", "fleet");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: assets } = await supabase.from("assets").select("id, name, registration_number").is("archived_at", null).order("name");

  const initial: Record<string, string> = {};
  let title = "Add compliance document";
  if (sp.renew) {
    const { data: old } = await supabase.from("compliance_documents").select("*").eq("id", sp.renew).maybeSingle();
    if (old) {
      title = `Renew ${old.document_type}`;
      Object.assign(initial, { renew_id: old.id, asset_id: old.asset_id ?? "", document_type: old.document_type, issuer: old.issuer ?? "" });
    }
  } else if (sp.asset) {
    initial.asset_id = sp.asset;
  }
  return (
    <>
      <PageHeader title={title} subtitle={sp.renew ? "The old document is kept in history and stops raising alerts." : undefined} />
      <Card className="p-4 sm:p-6">
        <DocumentForm assets={assets ?? []} initial={initial} />
      </Card>
    </>
  );
}
