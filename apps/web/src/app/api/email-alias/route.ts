import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { log } from "@/lib/logger";

/** GET /api/email-alias — Return the current forwarding email for the business */
export async function GET() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { businessId } = auth.ctx;

  const { data: business, error } = await supabase
    .from("businesses")
    .select("ii_forwarding_email")
    .eq("id", businessId)
    .single();

  if (error || !business) {
    log.error("Failed to fetch forwarding email", { businessId });
    return NextResponse.json(
      { error: "Failed to load email alias" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    forwarding_email: business.ii_forwarding_email,
  });
}

/** POST /api/email-alias — Generate or regenerate a forwarding email */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  let body: { action: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;
  if (action !== "generate" && action !== "regenerate") {
    return NextResponse.json(
      { error: "Invalid action. Use 'generate' or 'regenerate'." },
      { status: 400 }
    );
  }

  // Get user's name for initials
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Extract first/last name from user metadata or email.
  // Normalize so the RPC always receives a non-empty first name
  // and a genuine null (not "") for missing last names.
  const metadata = user.user_metadata ?? {};
  const rawFirst =
    metadata.first_name?.trim() ||
    metadata.full_name?.split(" ")[0]?.trim() ||
    user.email?.split("@")[0]?.trim() ||
    "";
  const firstName = rawFirst || "U";
  const rawLast =
    metadata.last_name?.trim() ||
    metadata.full_name?.split(" ").slice(1).join(" ").trim() ||
    "";
  const lastName = rawLast || null;

  // Capture the current alias before regeneration so we can audit the change
  let previousAlias: string | null = null;
  if (action === "regenerate") {
    const { data: biz } = await supabase
      .from("businesses")
      .select("ii_forwarding_email")
      .eq("id", businessId)
      .single();
    previousAlias = biz?.ii_forwarding_email ?? null;
  }

  const rpcName =
    action === "regenerate"
      ? "regenerate_ii_forwarding_email"
      : "generate_ii_forwarding_email";

  const { data: email, error } = await supabase.rpc(rpcName, {
    p_business_id: businessId,
    p_first_name: firstName,
    p_last_name: lastName,
  });

  if (error || !email || typeof email !== "string") {
    const errorMsg = error?.message ?? "RPC returned null or non-string";
    const errorCode = error?.code;

    log.error("Failed to generate forwarding email", {
      businessId,
      userId,
      action,
      errorCode,
      error: errorMsg,
    });

    // Unique constraint violation (Postgres 23505) — race condition between
    // the RPC's existence check and the UPDATE. Extremely rare but possible.
    if (errorCode === "23505") {
      return NextResponse.json(
        { error: "Alias collision — please try again" },
        { status: 409 }
      );
    }

    // RPC raised an exception after exhausting all 50 uniqueness attempts
    if (errorMsg.includes("unique forwarding email after")) {
      return NextResponse.json(
        { error: "Could not generate a unique alias. Please try again." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate email alias" },
      { status: 500 }
    );
  }

  // Sanity-check: the RPC should return a valid-looking email
  if (!email.includes("@") || email.length > 320) {
    log.error("RPC returned malformed forwarding email", {
      businessId,
      userId,
      emailLength: email.length,
    });
    return NextResponse.json(
      { error: "Failed to generate email alias" },
      { status: 500 }
    );
  }

  // Audit trail — especially important for regeneration since the old alias
  // immediately stops receiving emails (destructive action).
  if (action === "regenerate") {
    await supabase.rpc("log_ii_audit_event", {
      p_business_id: businessId,
      p_actor_id: userId,
      p_entity_type: "business",
      p_entity_id: businessId,
      p_event_type: "email_alias_regenerated",
      p_after_state: { new_alias: email },
      p_metadata: { previous_alias: previousAlias },
    });
  }

  log.info("Forwarding email generated", {
    businessId,
    userId,
    action,
  });

  return NextResponse.json({ forwarding_email: email });
}
