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

/**
 * Provider-injected client-IP headers that are set/overwritten at the edge.
 * We intentionally do NOT trust generic forwarding headers like x-forwarded-for.
 */
const TRUSTED_IP_HEADERS = [
  "cf-connecting-ip",        // Cloudflare
  "x-vercel-forwarded-for",  // Vercel
  "fly-client-ip",           // Fly.io
  "fastly-client-ip",        // Fastly
  "x-azure-clientip",        // Azure Front Door / App Gateway
  "x-nf-client-connection-ip", // Netlify
] as const;

export async function middleware(request: NextRequest) {
  // ------------------------------------------
  // 1. Supabase auth session refresh
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
  // 2. Rate-limit API routes
  // ------------------------------------------
  // Skip rate limiting for webhook endpoints — these are called by external
  // services (Stripe) with their own retry logic. Rate-limiting them could
  // cause missed events and broken subscription syncs.
  const isWebhook = request.nextUrl.pathname.startsWith("/api/webhooks/");

  if (request.nextUrl.pathname.startsWith("/api/") && !isWebhook) {
    const ip = getTrustedClientIp(request) ?? "unknown";

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

    // Always enforce IP-level rate limits using trusted edge-provided IP only.
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

    // Enforce per-user limits only from a verified Supabase identity.
    if (user?.id) {
      const userKey = `user:${user.id}:${tier}`;
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
 * Read client IP from provider-managed headers only.
 * Returns null when no trusted header is available.
 */
function getTrustedClientIp(request: NextRequest): string | null {
  for (const headerName of TRUSTED_IP_HEADERS) {
    const rawValue = request.headers.get(headerName);
    if (!rawValue) continue;

    // Some platforms provide comma-separated values; take first hop.
    const candidate = rawValue.split(",")[0]?.trim();
    if (candidate && isValidIp(candidate)) {
      return candidate;
    }
  }

  return null;
}

function isValidIp(value: string): boolean {
  // Strict-ish validation for IPv4 and IPv6 literals.
  const ipv4Pattern =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  const ipv6Pattern = /^[0-9a-fA-F:]+$/;
  return ipv4Pattern.test(value) || (value.includes(":") && ipv6Pattern.test(value));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
