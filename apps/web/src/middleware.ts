import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// ============================================
// Rate limit configs
// ============================================
// Three tiers: reads, general mutations, and file uploads.
// Each key is checked per-IP *and* per-user (when authenticated),
// so a single user can't exhaust the IP-level budget.
const RATE_LIMITS = {
  /** GET requests */
  read:   { limit: 60,  windowMs: 60_000 },    // 60 req/min
  /** POST/PATCH/PUT/DELETE (non-upload) */
  mutate: { limit: 30,  windowMs: 60_000 },    // 30 req/min
  /** POST /api/receipts specifically — heavy (20MB files + AI processing) */
  upload: { limit: 10,  windowMs: 60_000 },    // 10 uploads/min
  /** POST /api/email-alias — destructive (regeneration invalidates old alias) */
  alias:  { limit: 5,   windowMs: 3_600_000 }, // 5 per hour
} as const;

// ============================================
// Security headers applied to every response
// ============================================
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export async function middleware(request: NextRequest) {
  // ------------------------------------------
  // 1. Rate-limit API routes
  // ------------------------------------------
  // Skip rate limiting for webhook endpoints — these are called by external
  // services (Stripe) with their own retry logic. Rate-limiting them could
  // cause missed events and broken subscription syncs.
  const isWebhook = request.nextUrl.pathname.startsWith("/api/webhooks/");

  if (request.nextUrl.pathname.startsWith("/api/") && !isWebhook) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const isMutation = ["POST", "PATCH", "PUT", "DELETE"].includes(
      request.method
    );
    const isUpload =
      isMutation &&
      request.method === "POST" &&
      request.nextUrl.pathname === "/api/receipts";
    const isAlias =
      isMutation &&
      request.method === "POST" &&
      request.nextUrl.pathname === "/api/email-alias";

    const config = isAlias
      ? RATE_LIMITS.alias
      : isUpload
        ? RATE_LIMITS.upload
        : isMutation
          ? RATE_LIMITS.mutate
          : RATE_LIMITS.read;

    const tier = isAlias
      ? "alias"
      : isUpload
        ? "upload"
        : isMutation
          ? "mutate"
          : "read";

    // Always check IP-level limit
    const ipKey = `ip:${ip}:${tier}`;
    const ipResult = checkRateLimit(ipKey, config);

    if (!ipResult.allowed) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "Too many requests. Please try again later." },
          {
            status: 429,
            headers: {
              "Retry-After": String(
                Math.ceil((ipResult.retryAfterMs ?? config.windowMs) / 1000)
              ),
            },
          }
        )
      );
    }

    // Also check per-user limit when we can extract a user ID from the
    // Supabase session cookie. This prevents a single authenticated user
    // from consuming the entire IP budget (important for shared-IP
    // environments like offices or VPNs).
    const sbAccessToken = request.cookies.get("sb-access-token")?.value
      ?? request.cookies.get(
           // Supabase uses a project-ref-prefixed cookie name
           Array.from(request.cookies.getAll().map((c) => c.name))
             .find((n) => n.startsWith("sb-") && n.endsWith("-auth-token")) ?? ""
         )?.value;

    if (sbAccessToken) {
      // Extract the sub (user id) from the JWT payload without full
      // verification — we only need it as a rate-limit key, not for auth.
      // Auth verification happens later in each API route.
      const userId = extractJwtSub(sbAccessToken);
      if (userId) {
        const userKey = `user:${userId}:${tier}`;
        const userResult = checkRateLimit(userKey, config);

        if (!userResult.allowed) {
          return withSecurityHeaders(
            NextResponse.json(
              { error: "Too many requests. Please try again later." },
              {
                status: 429,
                headers: {
                  "Retry-After": String(
                    Math.ceil(
                      (userResult.retryAfterMs ?? config.windowMs) / 1000
                    )
                  ),
                },
              }
            )
          );
        }
      }
    }
  }

  // ------------------------------------------
  // 2. Supabase auth session refresh
  // ------------------------------------------
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: CookieOptions;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth token — this is the primary purpose of middleware
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ------------------------------------------
  // 3. Route protection
  // ------------------------------------------
  // Protect /app/* and /onboarding routes — redirect to login if no session
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/app") ||
    request.nextUrl.pathname.startsWith("/onboarding");

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  // If user is logged in and visiting auth pages, redirect to dashboard
  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth");
  if (
    isAuthRoute &&
    user &&
    !request.nextUrl.pathname.startsWith("/auth/callback")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/dashboard";
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  // ------------------------------------------
  // 4. Apply security headers
  // ------------------------------------------
  return withSecurityHeaders(supabaseResponse);
}

// ============================================
// Helpers
// ============================================

/** Apply security headers to any NextResponse */
function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Extract the `sub` claim from a JWT without cryptographic verification.
 * We only use this as a rate-limit key — actual auth verification happens
 * downstream in each API route via Supabase's getUser().
 *
 * Returns null if the token is malformed or missing a sub claim.
 */
function extractJwtSub(token: string): string | null {
  try {
    // JWT structure: header.payload.signature
    // The Supabase auth token may be a raw JWT or a JSON-encoded
    // string containing "access_token".
    let jwt = token;

    // Handle the case where the cookie value is a JSON blob
    // e.g. {"access_token":"eyJ...","...}
    if (token.startsWith("{")) {
      try {
        const parsed = JSON.parse(token);
        jwt = parsed.access_token ?? parsed[0]?.access_token ?? token;
      } catch {
        // Not JSON — treat as raw JWT
      }
    }

    const parts = jwt.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
