import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-lg font-bold text-white">A</div>
          <h1 className="text-xl font-semibold text-slate-900">Alexon Fleet</h1>
          <p className="text-sm text-slate-500">Fleet & Asset Management</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm
            next={sp.next ?? "/dashboard"}
            notice={sp.reason === "inactive" ? "Your account is not active. Contact the system administrator." : undefined}
          />
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Accounts are created by the system administrator.</p>
      </div>
    </main>
  );
}
