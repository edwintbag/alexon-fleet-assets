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
