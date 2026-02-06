import "server-only";

/**
 * Returns a trusted base URL for internal server-to-server API calls.
 * Never derive this from inbound request host/proto headers.
 */
export function getInternalApiBaseUrl(): string {
  const raw =
    process.env.INTERNAL_API_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL;

  if (!raw) {
    throw new Error(
      "Missing INTERNAL_API_BASE_URL/NEXT_PUBLIC_APP_URL for internal API calls"
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid INTERNAL_API_BASE_URL/NEXT_PUBLIC_APP_URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Internal API base URL must use http or https");
  }

  return parsed.origin;
}

/** Canonical URL for receipt extraction callback endpoint. */
export function getProcessReceiptUrl(): URL {
  return new URL("/api/internal/process-receipt", getInternalApiBaseUrl());
}
