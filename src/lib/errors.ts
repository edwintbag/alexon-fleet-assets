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
  REASON_REQUIRED: "Give a reason (at least 3 characters).",
  RESOLUTION_REQUIRED: "Say what was done to fix it.",
  BREAKDOWN_NOT_FOUND: "Breakdown not found.",
  USE_STOCK_MOVEMENT: "Stock can only be changed with the Move stock form.",
  QUANTITY_INVALID: "Enter a quantity greater than zero.",
  PART_NOT_FOUND: "Spare part not found.",
  PR_HAS_NO_ITEMS: "Add at least one item before submitting.",
  PR_NOT_FOUND: "Purchase request not found.",
  PR_NOT_RECEIVABLE: "Only approved or ordered requests can be received.",
  CANNOT_APPROVE_OWN_REQUEST: "You raised this request, so someone else must approve it.",
  INVALID_TRANSITION: "That step isn't possible from the request's current status.",
  ITEM_NOT_FOUND: "Item not found.",
  MORE_THAN_ORDERED: "That is more than is still outstanding on this line.",
  PLAN_NOT_FOUND: "Buying plan not found.",
  PLAN_PAUSED: "This buying plan is paused. Resume it first.",
  assets_reg_unique: "Another asset already uses this registration number.",
  spare_parts_number_unique: "Another part already uses this part number.",
  suppliers_name_key: "A supplier with this name already exists.",
};

export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Something went wrong.";
  const msg = error.message ?? "";
  // keep the useful detail, e.g. "INSUFFICIENT_STOCK: only 10.00 litres in stock"
  const stock = msg.match(/INSUFFICIENT_STOCK:\s*(.*)$/);
  if (stock) return `Not enough stock — ${stock[1].replace(/\.00\b/, "")}.`;
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
