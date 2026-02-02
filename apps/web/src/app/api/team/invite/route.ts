import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth-helpers";
import { TeamInviteSchema } from "@/lib/validation";
import { canInviteMember } from "@/lib/plan-gate";
import { sendInvitationEmail } from "@/lib/email";
import { log } from "@/lib/logger";

/**
 * POST /api/team/invite
 *
 * Send a team invitation. Admin/owner only.
 * Checks seat limits before creating invitation.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await requireRole(supabase, ["owner", "admin"]);
  if ("error" in auth) return auth.error;
  const { userId, businessId, role: callerRole } = auth.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const parsed = TeamInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { email, role } = parsed.data;

  // Only owners can invite with admin role — prevents privilege escalation
  if (role === "admin" && callerRole !== "owner") {
    return NextResponse.json(
      { error: "Only the owner can invite members as admin" },
      { status: 403 }
    );
  }

  // Check seat limit
  const seats = await canInviteMember(businessId);
  if (!seats.allowed) {
    return NextResponse.json(
      {
        error: `Seat limit reached (${seats.used}/${seats.limit}). Upgrade your plan for more seats.`,
        upgrade: true,
      },
      { status: 403 }
    );
  }

  // Check if this email already belongs to an active member.
  // We look up auth.users by email via the admin-accessible view, then check
  // business_members. Since the Supabase client here is user-scoped, we check
  // the invitations table as a proxy — but also need to check if someone who
  // already accepted a previous invite (i.e. is an active member) is being
  // re-invited. We use a two-step approach:
  // 1. Check for an existing active member by looking at accepted invitations
  //    for this email (covers the case where they joined via invitation).
  // 2. Check for pending invitations.

  // Step 1: Check if this email was already accepted for this business
  const { data: acceptedInvite } = await supabase
    .from("business_invitations")
    .select("id")
    .eq("business_id", businessId)
    .eq("email", email.toLowerCase())
    .not("accepted_at", "is", null)
    .limit(1)
    .single();

  if (acceptedInvite) {
    return NextResponse.json(
      { error: "This email is already a member of the business" },
      { status: 409 }
    );
  }

  // Step 2: Check for a pending (not yet accepted) invitation
  const { data: existingInvite } = await supabase
    .from("business_invitations")
    .select("id")
    .eq("business_id", businessId)
    .eq("email", email.toLowerCase())
    .is("accepted_at", null)
    .limit(1)
    .single();

  if (existingInvite) {
    return NextResponse.json(
      { error: "An invitation has already been sent to this email" },
      { status: 409 }
    );
  }

  // Create invitation
  const { data: invitation, error: insertError } = await supabase
    .from("business_invitations")
    .insert({
      business_id: businessId,
      email: email.toLowerCase(),
      role,
      invited_by: userId,
    })
    .select("id, token, email, role, expires_at")
    .single();

  // token is extracted for the email below but must NOT be returned to the caller

  if (insertError) {
    log.error("Failed to create invitation", {
      businessId,
      email,
      error: insertError.message,
    });
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }

  log.info("Team invitation created", {
    businessId,
    invitedEmail: email,
    role,
    invitedBy: userId,
  });

  // Send invitation email (non-blocking — don't fail the request if email fails)
  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .single();

  const { data: inviterProfile } = await supabase.auth.getUser();

  sendInvitationEmail({
    to: email,
    token: invitation.token,
    role,
    businessName: business?.name ?? "your team",
    inviterName: inviterProfile?.user?.user_metadata?.full_name,
  }).catch((err) => {
    log.error("Background invitation email failed", { email, error: String(err) });
  });

  // Strip the token from the response — it should only be delivered via email
  const { token: _token, ...safeInvitation } = invitation;
  return NextResponse.json({ invitation: safeInvitation }, { status: 201 });
}
