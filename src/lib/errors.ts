const MESSAGES: Record<string, string> = {
  NOT_AUTHORISED: "You don't have permission to do that.",
  USE_READING_FORM: "Readings can only be changed with the Update reading form.",
  METER_TYPE_LOCKED: "Meter type can't be changed after readings exist.",
  ASSET_NOT_FOUND: "Asset not found.",
  ASSET_HAS_NO_METER: "This asset has no KM/hours meter.",
  READING_INVALID: "Enter a valid reading.",
  READING_IN_FUTURE: "The reading time can't be in the future.",
  READING_OLDER_THAN_LATEST: "There is already a newer reading. Enter the latest reading instead.",
  READING_BELOW_CURRENT: "The reading is lower than the current reading. Ask an Admin to correct it.",
  CORRECTION_REASON_REQUIRED: "A lower reading is a correction — add a reason (at least 5 characters).",
  HOURS_EXCEED_ELAPSED_TIME: "More engine hours than time has passed since the last reading. Check the number.",
  SERVICE_DATE_INVALID: "The service date can't be in the future.",
  NO_SERVICE_PLAN: "Set up a service plan for this asset first.",
  SERVICE_READING_REQUIRED: "Enter the KM/hours at service.",
  SERVICE_READING_BELOW_LAST_SERVICE: "The service reading is lower than the last service reading.",
  SERVICE_DATE_BEFORE_LAST_SERVICE: "The service date is earlier than the last recorded service.",
  CANNOT_CHANGE_OWN_ROLE: "You can't change your own role or deactivate yourself.",
  assets_reg_unique: "Another asset already uses this registration number.",
};

export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Something went wrong.";
  const msg = error.message ?? "";
  for (const key of Object.keys(MESSAGES)) {
    if (msg.includes(key)) return MESSAGES[key];
  }
  if (error.code === "42501" || msg.includes("row-level security")) return MESSAGES.NOT_AUTHORISED;
  if (error.code === "23505") return "That value already exists.";
  console.error("[AFAMS]", error);
  return "Something went wrong. Please try again.";
}

export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  warning?: string;
  values?: Record<string, string>;
  nonce?: number;
} | null;
