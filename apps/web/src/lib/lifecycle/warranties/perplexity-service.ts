import "server-only";

const BASE_URL = "https://api.perplexity.ai/chat/completions";

interface PerplexityResponse {
  choices?: Array<{ message?: { content?: string } }>;
  citations?: string[];
}

interface RawWarrantyResult {
  hasWarranty?: boolean;
  manufacturer?: string | null;
  warrantyMonths?: number | null;
  confidence?: number | null;
  rationale?: string | null;
  sourceUrls?: string[] | null;
}

export interface WarrantyLookupResult {
  hasWarranty: boolean;
  manufacturer: string | null;
  warrantyMonths: number | null;
  confidence: number | null;
  rationale: string | null;
  sourceUrls: string[];
  rawContent: string;
}

function parseJsonFromContent(content: string): unknown | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : content;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    return null;
  }
}

function clampConfidence(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Math.round(value * 100) / 100;
}

export async function lookupWarrantyWithPerplexity(input: {
  apiKey: string;
  itemName: string;
  description?: string | null;
  merchant?: string | null;
  purchaseDate?: string | null;
  totalPriceCents?: number | null;
}): Promise<WarrantyLookupResult> {
  if (!input.apiKey) {
    throw new Error("PERPLEXITY_API_KEY is not configured");
  }

  const userPrompt = [
    `Item: ${input.itemName}`,
    input.description ? `Description: ${input.description}` : null,
    input.merchant ? `Merchant: ${input.merchant}` : null,
    input.purchaseDate ? `Purchase date: ${input.purchaseDate}` : null,
    input.totalPriceCents != null
      ? `Price: $${(input.totalPriceCents / 100).toFixed(2)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You verify consumer product warranty coverage. Return JSON only.
Format:
{
  "hasWarranty": boolean,
  "manufacturer": "string or null",
  "warrantyMonths": number or null,
  "confidence": number between 0 and 1,
  "rationale": "short explanation",
  "sourceUrls": ["url1", "url2"]
}
Rules:
- Set hasWarranty=true only when there is credible evidence.
- Set warrantyMonths to null when unknown.
- Keep rationale under 160 characters.
- Prefer official manufacturer or retailer sources.`;

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 800,
      return_citations: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Perplexity request failed (${response.status}): ${responseText.substring(0, 200)}`
    );
  }

  let data: PerplexityResponse;
  try {
    data = JSON.parse(responseText) as PerplexityResponse;
  } catch {
    throw new Error("Perplexity returned invalid JSON");
  }

  const content = data.choices?.[0]?.message?.content ?? "";
  const citations = data.citations ?? [];
  const parsed = parseJsonFromContent(content) as RawWarrantyResult | null;
  const sourceUrls = Array.isArray(parsed?.sourceUrls)
    ? parsed!.sourceUrls!.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

  return {
    hasWarranty: Boolean(parsed?.hasWarranty),
    manufacturer:
      typeof parsed?.manufacturer === "string" && parsed.manufacturer.length > 0
        ? parsed.manufacturer
        : null,
    warrantyMonths:
      typeof parsed?.warrantyMonths === "number" && parsed.warrantyMonths > 0
        ? Math.round(parsed.warrantyMonths)
        : null,
    confidence: clampConfidence(
      typeof parsed?.confidence === "number" ? parsed.confidence : null
    ),
    rationale:
      typeof parsed?.rationale === "string" && parsed.rationale.length > 0
        ? parsed.rationale
        : null,
    sourceUrls: sourceUrls.length > 0 ? sourceUrls : citations,
    rawContent: content,
  };
}
