import { requireRole, ROLE_LABELS, type Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, PageHeader, inputClass } from "@/components/ui";
import { AddUserForm } from "@/components/add-user-form";
import { updateUser } from "./actions";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireRole("admin");
  const supabase = await createClient();
  const { data: users } = await supabase.from("profiles").select("id, full_name, email, role, is_active, created_at").order("full_name");

  return (
    <>
      <PageHeader title="Users" subtitle="People who can sign in, and what they can do" />
      <Card className="animate-rise mb-6">
        <CardHeader title="Add user" />
        <div className="p-4 sm:p-5"><AddUserForm /></div>
      </Card>
      <Card className="animate-rise">
        <CardHeader title={`${users?.length ?? 0} users`} />
        <ul className="stagger divide-y divide-slate-100">
          {(users ?? []).map((u) => (
            <li key={u.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <p className="font-medium text-slate-900">{u.full_name || u.email} {u.id === me.id && <span className="text-xs text-slate-500">(you)</span>}</p>
                <p className="text-sm text-slate-500">{u.email} · {ROLE_LABELS[u.role as Role]}</p>
              </div>
              {u.id === me.id ? (
                <Badge tone="green">Active</Badge>
              ) : (
                <form action={updateUser} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role} className={`${inputClass} w-auto`}>
                    {Object.entries(ROLE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  <select name="is_active" defaultValue={String(u.is_active)} className={`${inputClass} w-auto`}>
                    <option value="true">Active</option>
                    <option value="false">Deactivated</option>
                  </select>
                  <button className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[.98]">Update</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
