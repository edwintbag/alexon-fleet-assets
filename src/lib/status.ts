export type ServiceStatus = "normal" | "approaching" | "due_soon" | "due" | "overdue" | "no_data";
export type ComplianceStatus = "valid" | "expiring_soon" | "expired";
export type Tone = "green" | "blue" | "amber" | "orange" | "red" | "slate";

export const SERVICE_STATUS: Record<ServiceStatus, { label: string; tone: Tone; rank: number }> = {
  overdue: { label: "Overdue", tone: "red", rank: 5 },
  due: { label: "Due", tone: "orange", rank: 4 },
  due_soon: { label: "Due soon", tone: "amber", rank: 3 },
  approaching: { label: "Approaching", tone: "blue", rank: 2 },
  normal: { label: "OK", tone: "green", rank: 1 },
  no_data: { label: "Needs setup", tone: "slate", rank: 0 },
};

export const COMPLIANCE_STATUS: Record<ComplianceStatus, { label: string; tone: Tone }> = {
  expired: { label: "Expired", tone: "red" },
  expiring_soon: { label: "Expiring soon", tone: "amber" },
  valid: { label: "Valid", tone: "green" },
};

export const OPERATIONAL_STATUS: Record<string, { label: string; tone: Tone }> = {
  operational: { label: "Operational", tone: "green" },
  under_maintenance: { label: "Under maintenance", tone: "amber" },
  breakdown: { label: "Breakdown", tone: "red" },
  standby: { label: "Standby", tone: "slate" },
  disposed: { label: "Disposed", tone: "slate" },
};

export const DOCUMENT_TYPES = [
  "Insurance",
  "Motor Vehicle Inspection",
  "Road / Service Licence",
  "Permit",
  "Certificate",
  "Other",
];

export const BREAKDOWN_STATUS: Record<string, { label: string; tone: Tone }> = {
  reported: { label: "Reported", tone: "red" },
  in_progress: { label: "In progress", tone: "amber" },
  awaiting_parts: { label: "Awaiting parts", tone: "orange" },
  resolved: { label: "Resolved", tone: "green" },
};

export const SEVERITY: Record<string, { label: string; tone: Tone }> = {
  critical: { label: "Critical", tone: "red" },
  major: { label: "Major", tone: "amber" },
  minor: { label: "Minor", tone: "slate" },
};

export const STOCK_STATUS: Record<string, { label: string; tone: Tone }> = {
  ok: { label: "In stock", tone: "green" },
  low: { label: "Low stock", tone: "amber" },
  out_of_stock: { label: "Out of stock", tone: "red" },
};

export const PR_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "slate" },
  submitted: { label: "Awaiting approval", tone: "amber" },
  approved: { label: "Approved", tone: "blue" },
  rejected: { label: "Rejected", tone: "red" },
  ordered: { label: "Ordered", tone: "blue" },
  received: { label: "Received", tone: "green" },
  cancelled: { label: "Cancelled", tone: "slate" },
};

export const PART_UNITS = ["pcs", "litres", "kg", "metres", "set", "pair"];
