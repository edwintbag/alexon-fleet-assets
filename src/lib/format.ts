const TZ = "Africa/Nairobi";

export function todayNairobi(): string {
  // YYYY-MM-DD in Nairobi time
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" && value.length === 10 ? new Date(value + "T12:00:00Z") : new Date(value);
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export function daysAgo(days: number | null | undefined): string {
  if (days === null || days === undefined) return "date unknown";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function formatNumber(n: number | string | null | undefined, digits = 0): string {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString("en-KE", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function unitFor(meter: string | null | undefined): string {
  return meter === "hours" ? "hrs" : meter === "km" ? "km" : "";
}

export function formatMeter(n: number | string | null | undefined, meter: string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  return `${formatNumber(n, 1)} ${unitFor(meter)}`.trim();
}

export function formatKES(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  return "KES " + Number(n).toLocaleString("en-KE", { maximumFractionDigits: 2 });
}

/** "KDW288H" → "KDW 288H" (Kenyan plates); other formats are returned unchanged */
export function formatReg(reg: string | null | undefined): string {
  if (!reg) return "—";
  const m = reg.match(/^([A-Z]{3,4})(\d{3}[A-Z]?)$/);
  return m ? `${m[1]} ${m[2]}` : reg;
}

/** Accepts "33,117", "33117 km", "1,234.5" → number, or null if invalid */
export function parseReading(input: FormDataEntryValue | null): number | null {
  if (input === null) return null;
  const cleaned = String(input).replace(/,/g, "").replace(/[a-zA-Z\s]/g, "");
  if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}
