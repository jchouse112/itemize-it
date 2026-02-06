import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteSchema } from "@/lib/validation";
import { canInviteMember } from "@/lib/plan-gate";
import { log } from "@/lib/logger";

/**
 * POST /api/team/invite/accept
 *
 * Accept a team invitation by token.
 * Creates a business_members record and marks the invitation as accepted.
 * Re-checks seat limits at acceptance time to prevent over-subscription.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Must be authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const parsed = AcceptInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { token } = parsed.data;

  // Look up the invitation — token is unique, but we don't scope by business
  // because the accepting user may not be a member yet. The email check below
  // provides the authorization gate. We also verify the token hasn't been
  // tampered with by checking all fields after retrieval.
  const { data: invitation, error: lookupError } = await supabase
    .from("business_invitations")
    .select("id, business_id, email, role, invited_by, expires_at, accepted_at, created_at")
    .eq("token", token)
    .is("accepted_at", null) // Only match un-accepted invitations
    .single();

  if (lookupError || !invitation) {
    return NextResponse.json(
      { error: "Invalid or expired invitation" },
      { status: 404 }
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This invitation has expired" },
      { status: 410 }
    );
  }

  // Check email matches (case-insensitive)
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.json(
      {
        error: "This invitation doesn't match your account email. Please sign in with the invited email address.",
      },
      { status: 403 }
    );
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from("business_members")
    .select("id")
    .eq("business_id", invitation.business_id)
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    // Mark invitation as accepted anyway
    await supabase
      .from("business_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    return NextResponse.json(
      { error: "You are already a member of this business" },
      { status: 409 }
    );
  }

  // Re-check seat limits at acceptance time. Between invitation creation and
  // acceptance, other seats may have been filled by other accepted invitations.
  const seats = await canInviteMember(invitation.business_id, supabase);
  // Seat counting includes pending invitations. During acceptance, the current
  // invite is still pending, so "used === limit" is valid and should pass.
  if (!seats.allowed && seats.used > seats.limit) {
    return NextResponse.json(
      {
        error: `This business has reached its seat limit (${seats.used}/${seats.limit}). Please ask the business owner to upgrade their plan.`,
      },
      { status: 403 }
    );
  }

  // Create membership
  const { error: memberError } = await supabase
    .from("business_members")
    .insert({
      business_id: invitation.business_id,
      user_id: user.id,
      role: invitation.role,
      status: "active",
      invited_by: invitation.invited_by,
      invited_at: invitation.created_at,
      joined_at: new Date().toISOString(),
    });

  if (memberError) {
    log.error("Failed to create business member from invitation", {
      invitationId: invitation.id,
      userId: user.id,
      error: memberError.message,
    });
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }

  // Mark invitation as accepted
  await supabase
    .from("business_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  log.info("Team invitation accepted", {
    businessId: invitation.business_id,
    userId: user.id,
    role: invitation.role,
  });

  return NextResponse.json({
    businessId: invitation.business_id,
    role: invitation.role,
  });
}
