import Link from "next/link";
import { Users } from "lucide-react";
import { requireUser, canManageStock } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { SupplierForm } from "@/components/purchasing/supplier-form";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: suppliers } = await supabase.from("suppliers").select("*").order("name");
  const manage = canManageStock(user.role);

  return (
    <>
      <nav className="mb-3 text-sm text-slate-500"><Link href="/purchasing" className="hover:text-navy hover:underline">Purchasing</Link> <span className="text-slate-300">/</span> <span className="text-slate-700">Suppliers</span></nav>
      <PageHeader title="Suppliers" subtitle={`${suppliers?.length ?? 0} on file`} />

      {manage && (
        <Card className="animate-rise mb-5">
          <CardHeader title="Add supplier" icon={Users} />
          <div className="p-4 sm:p-5"><SupplierForm /></div>
        </Card>
      )}

      <Card className="animate-rise">
        {suppliers && suppliers.length > 0 ? (
          <ul className="stagger divide-y divide-slate-100">
            {suppliers.map((s) => (
              <li key={s.id} className="px-4 py-3 sm:px-5">
                <p className="font-medium text-slate-900">{s.name}</p>
                <p className="text-sm text-slate-500">
                  {[s.contact_person, s.phone, s.email, s.supplies].filter(Boolean).join(" · ") || "No contact details"}
                </p>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No suppliers yet" icon={Users} />}
      </Card>
    </>
  );
}
