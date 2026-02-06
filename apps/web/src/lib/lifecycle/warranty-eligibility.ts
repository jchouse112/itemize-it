import { detectWarrantyFromMerchant } from "@/lib/lifecycle/warranty-heuristics";

interface WarrantyEligibilityInput {
  itemName: string;
  description?: string | null;
  merchant?: string | null;
  totalPriceCents?: number | null;
}

interface WarrantyEligibilityResult {
  eligible: boolean;
  reason:
    | "durable_keyword"
    | "merchant_signal"
    | "high_value"
    | "consumable"
    | "insufficient_signal";
}

const MIN_VALUE_CENTS = 5_000; // $50
const HIGH_VALUE_CENTS = 20_000; // $200

const DURABLE_KEYWORDS = [
  "drill",
  "saw",
  "tool",
  "laptop",
  "computer",
  "monitor",
  "tablet",
  "phone",
  "camera",
  "printer",
  "washer",
  "dryer",
  "fridge",
  "refrigerator",
  "dishwasher",
  "microwave",
  "tv",
  "television",
  "speaker",
  "vacuum",
  "generator",
  "compressor",
];

const CONSUMABLE_KEYWORDS = [
  "lumber",
  "plywood",
  "2x4",
  "nail",
  "screw",
  "bolt",
  "adhesive",
  "glue",
  "paint",
  "caulk",
  "tape",
  "sandpaper",
  "filter",
  "fuel",
  "gas",
  "diesel",
  "meal",
  "snack",
  "coffee",
];

export function assessWarrantyEligibility(
  input: WarrantyEligibilityInput
): WarrantyEligibilityResult {
  const name = input.itemName.toLowerCase();
  const description = (input.description ?? "").toLowerCase();
  const merchant = (input.merchant ?? "").toLowerCase();
  const text = `${name} ${description}`.trim();
  const price = input.totalPriceCents ?? 0;

  if (CONSUMABLE_KEYWORDS.some((kw) => text.includes(kw))) {
    return { eligible: false, reason: "consumable" };
  }

  if (DURABLE_KEYWORDS.some((kw) => text.includes(kw))) {
    return { eligible: true, reason: "durable_keyword" };
  }

  if (merchant && detectWarrantyFromMerchant(merchant)) {
    return { eligible: true, reason: "merchant_signal" };
  }

  if (price >= HIGH_VALUE_CENTS) {
    return { eligible: true, reason: "high_value" };
  }

  if (price < MIN_VALUE_CENTS) {
    return { eligible: false, reason: "insufficient_signal" };
  }

  return { eligible: false, reason: "insufficient_signal" };
}
