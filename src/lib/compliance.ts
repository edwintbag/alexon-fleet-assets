import type { ComplianceRow } from "@/lib/attention";
import type { Tone } from "@/lib/status";

export type RequiredDoc = {
  key: "insurance" | "inspection";
  label: string;
  doc: ComplianceRow | null;
  state: "valid" | "expiring_soon" | "expired" | "missing";
};

export type ComplianceSummary = {
  overall: { label: string; tone: Tone };
  required: RequiredDoc[];
  others: ComplianceRow[];
};

const MATCH: Record<RequiredDoc["key"], RegExp> = {
  insurance: /insur/i,
  inspection: /inspect/i,
};

/**
 * What each type of asset must carry.
 * Road vehicles and trailers: insurance + motor vehicle inspection.
 * Machinery and equipment: insurance.
 */
function requiredFor(assetClass: string | null): RequiredDoc["key"][] {
  return assetClass === "vehicle" || assetClass === "trailer" ? ["insurance", "inspection"] : ["insurance"];
}

/** Picks the document with the latest expiry when there are several of one type. */
function latest(docs: ComplianceRow[]): ComplianceRow | null {
  return docs.reduce<ComplianceRow | null>((best, d) => (!best || d.expiry_date > best.expiry_date ? d : best), null);
}

export function complianceSummary(assetClass: string | null, docs: ComplianceRow[]): ComplianceSummary {
  const used = new Set<string>();
  const required: RequiredDoc[] = requiredFor(assetClass).map((key) => {
    const matches = docs.filter((d) => MATCH[key].test(d.document_type));
    matches.forEach((d) => used.add(d.id));
    const doc = latest(matches);
    return {
      key,
      label: key === "insurance" ? "Insurance" : "Inspection",
      doc,
      state: doc ? doc.status : "missing",
    };
  });
  const others = docs.filter((d) => !used.has(d.id)).sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));

  const all = [...required.map((r) => r.state), ...others.map((o) => o.status)];
  const overall: ComplianceSummary["overall"] =
    all.includes("expired") ? { label: "Not compliant", tone: "red" }
    : all.includes("missing") ? { label: "Records incomplete", tone: "amber" }
    : all.includes("expiring_soon") ? { label: "Compliant — renewal due soon", tone: "amber" }
    : { label: "Compliant", tone: "green" };

  return { overall, required, others };
}
