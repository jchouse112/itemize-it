/**
 * Perplexity AI recall search service.
 * Adapted from Recevity — stateless, no changes needed.
 */
import "server-only";

import type { RecallMatch, RecallSearchResult, SearchVectors } from "./types";

const BASE_URL = "https://api.perplexity.ai/chat/completions";

interface PerplexityResponse {
  choices?: Array<{ message?: { content?: string } }>;
  citations?: string[];
}

interface PerplexityRecallMention {
  title?: string;
  hazard?: string;
  url?: string;
  recallDate?: string;
  description?: string;
  remedy?: string;
  recallId?: string;
}

function buildQuery(item: SearchVectors): string {
  const parts: string[] = [];
  if (item.brand) parts.push(item.brand);
  if (item.model) {
    parts.push(item.model);
  } else if (item.name) {
    parts.push(item.name);
  } else {
    parts.push("product");
  }
  return `${parts.join(" ")} recall safety hazard`.trim();
}

function parseJsonFromContent(content: string): unknown | null {
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = match ? match[1] : content;
  try {
    return JSON.parse(jsonStr.trim());
  } catch {
    return null;
  }
}

function extractRecallMentions(parsed: unknown): PerplexityRecallMention[] {
  if (Array.isArray(parsed)) {
    return parsed as PerplexityRecallMention[];
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const list = obj.recalls ?? obj.matches ?? obj.results;
    if (Array.isArray(list)) {
      return list as PerplexityRecallMention[];
    }
  }
  return [];
}

export async function searchPerplexityRecalls(
  item: SearchVectors,
  apiKey: string
): Promise<RecallSearchResult> {
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY is not configured");
  }

  const query = buildQuery(item);
  const systemPrompt = `You are a product recall research assistant. Return JSON only (no markdown).
Response format:
{
  "recalls": [
    {
      "title": "recall title",
      "hazard": "short hazard summary",
      "url": "official recall notice url",
      "recallDate": "YYYY-MM-DD or null",
      "description": "short description or null",
      "remedy": "remedy or null"
    }
  ]
}
Only include items that are clearly recall notices.`;

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      temperature: 0.1,
      max_tokens: 1024,
      return_citations: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Perplexity request failed (${response.status}): ${responseText.substring(0, 200)}`);
  }

  let data: PerplexityResponse;
  try {
    data = JSON.parse(responseText) as PerplexityResponse;
  } catch {
    console.error("Perplexity returned non-JSON response:", responseText.substring(0, 200));
    return { matches: [], raw: { content: responseText, citations: [] } };
  }

  const content = data.choices?.[0]?.message?.content ?? "";
  const citations = data.citations ?? [];

  const parsed = parseJsonFromContent(content);
  const mentions = extractRecallMentions(parsed);

  const matches: RecallMatch[] = mentions
    .map<RecallMatch>((mention, index) => ({
      externalRecallId: mention.recallId ?? null,
      source: "perplexity",
      confidence: "medium",
      matchedOn: ["perplexity"],
      title: mention.title ?? "Recall mention",
      description: mention.description ?? null,
      hazard: mention.hazard ?? null,
      remedy: mention.remedy ?? null,
      recallDate: mention.recallDate ?? null,
      url: mention.url ?? citations[index] ?? citations[0] ?? null,
      rawResponse: { mention, citations } as Record<string, unknown>,
    }))
    .filter((match) => Boolean(match.title || match.url));

  return { matches, raw: { content, citations } };
}
