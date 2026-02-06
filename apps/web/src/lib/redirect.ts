const DEFAULT_REDIRECT_PATH = "/app/dashboard";

/**
 * Returns the first safe in-app path from candidates.
 * Accepts only absolute app-relative paths (e.g. "/app/receipts?x=1").
 */
export function pickSafeRedirectPath(
  candidates: Array<string | null | undefined>,
  fallback: string = DEFAULT_REDIRECT_PATH
): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!candidate.startsWith("/") || candidate.startsWith("//")) continue;
    return candidate;
  }
  return fallback;
}

