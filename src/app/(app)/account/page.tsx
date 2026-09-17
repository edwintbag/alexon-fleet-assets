import { requireUser, ROLE_LABELS } from "@/lib/auth";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { PasswordForm } from "@/components/password-form";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="My account" subtitle={`${user.email} · ${ROLE_LABELS[user.role]}`} />
      <Card className="max-w-lg">
        <CardHeader title="Change password" />
        <div className="p-4 sm:p-5"><PasswordForm /></div>
      </Card>
    </>
  );
}
