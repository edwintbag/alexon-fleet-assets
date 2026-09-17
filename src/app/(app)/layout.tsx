import { requireUser, ROLE_LABELS } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { signOut } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 flex-col bg-navy px-3 py-5 md:flex md:min-h-screen">
        <div className="mb-6 flex items-center gap-2 px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-bold text-white">A</div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">Alexon Fleet</p>
            <p className="text-[11px] text-slate-300">Asset Management</p>
          </div>
        </div>
        <Nav isAdmin={user.role === "admin"} variant="side" />
        <div className="mt-auto border-t border-white/10 px-3 pt-4">
          <a href="/account" className="block truncate text-sm font-medium text-white hover:underline">{user.fullName}</a>
          <p className="text-xs text-slate-300">{ROLE_LABELS[user.role]}</p>
          <form action={signOut} className="mt-2">
            <button className="text-xs text-slate-300 underline hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-navy text-sm font-bold text-white">A</div>
            <span className="text-sm font-semibold">Alexon Fleet</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/account" className="text-xs text-slate-500 underline">Account</a>
            <form action={signOut}>
              <button className="text-xs text-slate-500 underline">Sign out</button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-5 sm:px-6 md:pb-10 md:pt-8">{children}</main>
        <Nav isAdmin={user.role === "admin"} variant="bottom" />
      </div>
    </div>
  );
}
