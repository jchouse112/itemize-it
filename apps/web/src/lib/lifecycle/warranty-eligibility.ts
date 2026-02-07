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
    | "food_merchant"
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
  // Building materials
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
  // Food & beverage
  "food",
  "meal",
  "snack",
  "coffee",
  "poutine",
  "burger",
  "pizza",
  "sandwich",
  "salad",
  "soup",
  "fries",
  "latte",
  "espresso",
  "tea",
  "beer",
  "wine",
  "cocktail",
  "appetizer",
  "entree",
  "dessert",
  "lunch",
  "dinner",
  "breakfast",
  "chicken",
  "steak",
  "sushi",
  "taco",
  "wrap",
  "pasta",
  "wings",
  "nachos",
  "smoothie",
  "juice",
  "soda",
  "pop",
  "drink",
];

/** Merchants clearly in the food / entertainment / hospitality space */
const FOOD_MERCHANT_KEYWORDS = [
  "restaurant",
  "café",
  "cafe",
  "bistro",
  "grill",
  "bar",
  "pub",
  "kitchen",
  "diner",
  "eatery",
  "bakery",
  "pizzeria",
  "sushi",
  "starbucks",
  "tim hortons",
  "mcdonalds",
  "mcdonald's",
  "subway",
  "a&w",
  "wendy",
  "burger king",
  "popeyes",
  "chick-fil-a",
  "chipotle",
  "panera",
  "domino",
  "pizza hut",
  "taco bell",
  "kfc",
  "five guys",
  "shake shack",
  "dairy queen",
  // Entertainment / sports venues
  "arena",
  "stadium",
  "sports",
  "entertainment",
  "theatre",
  "theater",
  "cinema",
  "concession",
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

  // Check merchant against food / entertainment venues BEFORE durable checks
  // so a $200 dinner at Scotiabank Arena doesn't get flagged as "high_value"
  if (merchant && FOOD_MERCHANT_KEYWORDS.some((kw) => merchant.includes(kw))) {
    return { eligible: false, reason: "food_merchant" };
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
