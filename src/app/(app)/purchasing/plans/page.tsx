import Link from "next/link";
import { CalendarRange, Pause, Pencil, Play, Repeat, ShoppingCart, SkipForward } from "lucide-react";
import { requireUser, canRequestPurchase } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PurchasePlanRow } from "@/lib/attention";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, buttonClass, cn } from "@/components/ui";
import { ConfirmSubmit } from "@/components/form-bits";
import { PlanForm, type PlanValues } from "@/components/purchasing/plan-form";
import { formatDate, formatKES, formatNumber, todayNairobi } from "@/lib/format";
import { requestFromPlan, skipPlan, togglePlan } from "../actions";

export const metadata = { title: "Buying plan" };

const every = (m: number) => (m === 1 ? "every month" : m === 12 ? "every year" : `every ${m} months`);

function dueText(d: number) {
  if (d < 0) return `${-d} days late`;
  if (d === 0) return "due today";
  if (d === 1) return "tomorrow";
  return `in ${d} days`;
}

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ edit?: string; saved?: string; error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const manage = canRequestPurchase(user.role);
  const supabase = await createClient();

  const [{ data, error }, { data: parts }, { data: suppliers }, { data: assets }] = await Promise.all([
    supabase.from("v_purchase_plans").select("*").order("is_active", { ascending: false }).order("next_due_date"),
    supabase.from("spare_parts").select("id, name, unit, average_cost, supplier_id").is("archived_at", null).order("name"),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("assets").select("id, name, registration_number, asset_class").is("archived_at", null).order("asset_class").order("name"),
  ]);

  if (error) {
    return (
      <>
        <PageHeader title="Buying plan" />
        <Card><EmptyState title="Buying plan not set up yet" icon={Repeat}>Run supabase/07_plan_and_people.sql in Supabase, then reload.</EmptyState></Card>
      </>
    );
  }

  const plans = (data ?? []) as PurchasePlanRow[];
  const active = plans.filter((p) => p.is_active);
  const monthly = active.reduce((sum, p) => sum + (Number(p.estimated_unit_cost ?? 0) * Number(p.quantity)) / p.cycle_months, 0);
  const dueSoon = active.filter((p) => p.days_until_due <= 7).length;
  const editing = sp.edit ? plans.find((p) => p.id === sp.edit) : undefined;

  return (
    <>
      <nav className="mb-3 text-sm text-slate-500"><Link href="/purchasing" className="hover:text-navy hover:underline">Purchasing</Link> <span className="text-slate-300">/</span> <span className="text-slate-700">Buying plan</span></nav>
      <PageHeader
        title="Buying plan"
        subtitle="Parts you buy on a schedule, so they're in stock before they're needed — not bought in an emergency."
      />

      {sp.saved && <p className="mb-4 animate-pop rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/15">Plan saved.</p>}
      {sp.error && <p className="mb-4 animate-pop rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-600/15">{sp.error}</p>}

      <div className="stagger mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Active plans" value={active.length} icon={Repeat} />
        <StatCard label="Due in 7 days" value={dueSoon} tone={dueSoon ? "amber" : "slate"} icon={CalendarRange} />
        <div className="col-span-2 sm:col-span-1">
          <StatCard label="Planned spend" value={formatKES(Math.round(monthly))} icon={ShoppingCart} sub={`per month · ${formatKES(Math.round(monthly * 12))} a year`} />
        </div>
      </div>

      {editing && manage && (
        <Card id="form" className="animate-rise mb-5 scroll-mt-20 ring-2 ring-navy/20">
          <CardHeader title={`Edit: ${editing.name}`} right={<Link href="/purchasing/plans" className="text-sm text-slate-500 hover:underline">Cancel</Link>} />
          <div className="p-4 sm:p-5">
            <PlanForm plan={editing as unknown as PlanValues} parts={parts ?? []} suppliers={suppliers ?? []} assets={assets ?? []} today={todayNairobi()} />
          </div>
        </Card>
      )}

      {plans.length === 0 ? (
        <Card className="animate-rise mb-5">
          <EmptyState title="No plans yet" icon={Repeat}>
            Add one below — for example one tyre a month, taking turns between Mguu Kumi and Mguu Sita.
          </EmptyState>
        </Card>
      ) : (
        <div className="stagger mb-5 space-y-3">
          {plans.map((p) => {
            const d = p.days_until_due;
            const due = p.is_active && d <= 7;
            const tone = !p.is_active ? "slate" : d < 0 ? "red" : d === 0 ? "amber" : due ? "amber" : "green";
            const perTime = p.estimated_unit_cost ? Number(p.estimated_unit_cost) * Number(p.quantity) : null;
            return (
              <Card key={p.id} id={`plan-${p.id}`} className={cn("scroll-mt-20", !p.is_active && "opacity-70", due && "ring-2 ring-amber-400/40")}>
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">{p.name}</h2>
                      {!p.is_active && <Badge tone="slate" icon={false}>Paused</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-slate-700">
                      <span className="font-semibold tabular">{formatNumber(p.quantity, 2)}</span> × {p.description}
                      <span className="text-slate-400"> · </span>{every(p.cycle_months)}
                      {perTime !== null && <><span className="text-slate-400"> · </span><span className="tabular">≈ {formatKES(perTime)}</span></>}
                    </p>
                    {p.asset_names.length > 0 && (
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        {p.asset_names.map((n, i) => (
                          <span key={n + i} className={cn("rounded-full px-2 py-0.5 font-medium",
                            n === p.next_asset_name ? "bg-navy text-white" : "bg-slate-100 text-slate-600")}>
                            {n}{n === p.next_asset_name && p.asset_names.length > 1 ? " · next" : ""}
                          </span>
                        ))}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      {[p.supplier_name, p.part_name ? `adds to stock: ${p.part_name}` : null,
                        p.last_requested_at ? `last requested ${formatDate(p.last_requested_at)}` : "not requested yet"].filter(Boolean).join(" · ")}
                    </p>
                  </div>

                  <div className="shrink-0 sm:text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Next buy</p>
                    <p className="text-lg font-semibold tabular text-slate-900">{formatDate(p.next_due_date)}</p>
                    {p.is_active && <Badge tone={tone}>{dueText(d)}</Badge>}
                  </div>
                </div>

                {manage && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
                    {p.is_active && (
                      <form action={requestFromPlan}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmSubmit message={`Create a purchase request for ${formatNumber(p.quantity, 2)} × ${p.description}${p.next_asset_name ? ` (for ${p.next_asset_name})` : ""}?`}
                          className={due ? buttonClass.primary : buttonClass.secondary}>
                          <ShoppingCart className="h-4 w-4" /> Create request
                        </ConfirmSubmit>
                      </form>
                    )}
                    {p.is_active && (
                      <form action={skipPlan}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmSubmit message="Skip this time? The next date moves forward without buying." className={buttonClass.ghost}>
                          <SkipForward className="h-4 w-4" /> Skip this time
                        </ConfirmSubmit>
                      </form>
                    )}
                    <Link href={`/purchasing/plans?edit=${p.id}#form`} className={buttonClass.ghost}><Pencil className="h-4 w-4" /> Edit</Link>
                    <form action={togglePlan} className="ml-auto">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="active" value={String(!p.is_active)} />
                      <button className={buttonClass.ghost}>
                        {p.is_active ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Resume</>}
                      </button>
                    </form>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {manage && !editing && (
        <Card className="animate-rise">
          <CardHeader title="Add to the buying plan" subtitle="The dashboard reminds you a week before each buy" icon={Repeat} />
          <div className="p-4 sm:p-5">
            <PlanForm parts={parts ?? []} suppliers={suppliers ?? []} assets={assets ?? []} today={todayNairobi()} />
          </div>
        </Card>
      )}
    </>
  );
}
