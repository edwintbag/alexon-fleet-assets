import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-navy via-navy to-navy-900 p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-gold/10 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold shadow-lg shadow-brand/30">A</span>
          <span className="text-lg font-semibold tracking-tight">Alexon Group Ltd</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">What needs your attention today?</h2>
          <p className="mt-4 text-white/70">Services, readings, compliance documents and breakdowns for every vehicle and machine — in one place, on any device.</p>
          <ul className="mt-8 space-y-2 text-sm text-white/60">
            {["Know before a service is overdue", "Insurance and inspection expiry tracked", "A daily summary every morning"].map((t) => (
              <li key={t} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">Fleet &amp; Asset Management System</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-7 text-center lg:hidden">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-lg font-bold text-white">A</div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Alexon Fleet</h1>
            <p className="text-sm text-slate-500">Fleet &amp; Asset Management</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-lift)]">
            <h2 className="mb-1 hidden text-xl font-semibold tracking-tight text-slate-900 lg:block">Sign in</h2>
            <p className="mb-5 hidden text-sm text-slate-500 lg:block">Welcome back.</p>
            <LoginForm
              next={sp.next ?? "/dashboard"}
              notice={sp.reason === "inactive" ? "Your account is not active. Contact the system administrator." : undefined}
            />
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">Accounts are created by the system administrator.</p>
        </div>
      </div>
    </main>
  );
}
