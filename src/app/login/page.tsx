import Image from "next/image";
import { LoginForm } from "./login-form";
import cover from "@/assets/brand/cover.jpg";
import wordmark from "@/assets/brand/wordmark.png";
import wordmarkCompact from "@/assets/brand/wordmark-compact.png";

export const metadata = { title: "Sign in" };

/**
 * Dark wash over the fleet photo so every word on it stays readable.
 * Computer: dark band at the top (behind the logo) and a deep band rising from the
 * bottom (behind the headline), trucks visible in between.
 * Phone: an even wash, because the logo sits in the middle of the photo.
 */
function CoverOverlay({ variant }: { variant: "tall" | "banner" }) {
  if (variant === "banner") {
    return (
      <>
        <div className="absolute inset-0 bg-navy-900/60" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-900/50 via-transparent to-navy-900/70" aria-hidden />
      </>
    );
  }
  return (
    <>
      <div className="absolute inset-0 bg-navy-900/30" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-navy-900/90 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-navy-900 via-navy-900/85 to-transparent" aria-hidden />
    </>
  );
}

const shadow = "[text-shadow:0_2px_14px_rgba(5,4,40,.65)]";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* ---------- Cover (computer) ---------- */}
      <section className="relative hidden overflow-hidden lg:block">
        <Image src={cover} alt="Alexon Group trucks and JCB machines lined up" fill priority placeholder="blur"
          sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover object-[center_45%]" />
        <CoverOverlay variant="tall" />
        <div className="relative flex h-full min-h-screen flex-col justify-between p-10 xl:p-14">
          <Image src={wordmark} alt="Alexon Group Ltd — Your ever ready construction partner" priority
            className="h-auto w-[300px] drop-shadow-[0_6px_18px_rgba(0,0,0,.45)] xl:w-[340px]" />

          <div className={`max-w-lg text-white ${shadow}`}>
            <p className="mb-3 inline-flex rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wider text-white [text-shadow:none]">
              Fleet &amp; Asset Management
            </p>
            <h2 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">What needs your attention today?</h2>
            <p className="mt-4 text-lg leading-relaxed text-white/95">
              Services, readings, insurance, inspections and breakdowns for every truck and machine — in one place, on any device.
            </p>
            <ul className="mt-6 space-y-2 text-base font-medium text-white">
              {["Know before a service is overdue", "Insurance and inspection expiry tracked", "A summary in your inbox every morning"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand ring-2 ring-white/40" aria-hidden />{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Cover banner (phone / tablet) ---------- */}
      <section className="relative h-[38vh] min-h-[240px] overflow-hidden lg:hidden">
        <Image src={cover} alt="Alexon Group trucks and JCB machines lined up" fill priority placeholder="blur"
          sizes="100vw" className="object-cover object-[center_45%]" />
        <CoverOverlay variant="banner" />
        <div className="relative flex h-full flex-col items-center justify-center px-6 pb-8 text-center">
          <Image src={wordmarkCompact} alt="Alexon Group Ltd" priority
            className="h-auto w-[220px] drop-shadow-[0_6px_18px_rgba(0,0,0,.5)] sm:w-[260px]" />
          <p className={`mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-white ${shadow}`}>Fleet &amp; Asset Management</p>
        </div>
      </section>

      {/* ---------- Sign-in form ---------- */}
      <section className="relative -mt-8 flex justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:py-10">
        <div className="w-full max-w-sm animate-rise">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-lift)] sm:p-7">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
            <p className="mb-5 mt-1 text-sm text-slate-600">Welcome back. Use the email and password your administrator gave you.</p>
            <LoginForm
              next={sp.next ?? "/dashboard"}
              notice={sp.reason === "inactive" ? "Your account is not active. Contact the system administrator." : undefined}
            />
          </div>
          <p className="mt-5 text-center text-xs text-slate-500">Accounts are created by the system administrator.</p>
        </div>
      </section>
    </main>
  );
}
