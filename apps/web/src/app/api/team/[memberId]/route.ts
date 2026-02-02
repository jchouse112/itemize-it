import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth-helpers";
import { TeamMemberUpdateSchema } from "@/lib/validation";
import { log } from "@/lib/logger";

/**
 * PATCH /api/team/[memberId]
 *
 * Update a team member's role. Admin/owner only.
 * Cannot change your own role.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  const supabase = await createClient();
  const auth = await requireRole(supabase, ["owner", "admin"]);
  if ("error" in auth) return auth.error;
  const { userId, businessId, role: callerRole } = auth.ctx;

  // Get the target member
  const { data: targetMember } = await supabase
    .from("business_members")
    .select("id, user_id, role, business_id")
    .eq("id", memberId)
    .eq("business_id", businessId)
    .single();

  if (!targetMember) {
    return NextResponse.json(
      { error: "Member not found" },
      { status: 404 }
    );
  }

  // Cannot change own role
  if (targetMember.user_id === userId) {
    return NextResponse.json(
      { error: "You cannot change your own role" },
      { status: 403 }
    );
  }

  // Cannot change owner's role
  if (targetMember.role === "owner") {
    return NextResponse.json(
      { error: "Cannot change the owner's role" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const parsed = TeamMemberUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { role } = parsed.data;

  // Only owners can promote someone to admin — prevents privilege escalation
  // where an admin could create more admins who can manage billing, invites, etc.
  if (role === "admin" && callerRole !== "owner") {
    return NextResponse.json(
      { error: "Only the owner can promote members to admin" },
      { status: 403 }
    );
  }

  const { error: updateError } = await supabase
    .from("business_members")
    .update({ role })
    .eq("id", memberId);

  if (updateError) {
    log.error("Failed to update member role", {
      memberId,
      error: updateError.message,
    });
    return NextResponse.json(
      { error: "Failed to update member role" },
      { status: 500 }
    );
  }

  log.info("Team member role updated", {
    businessId,
    memberId,
    newRole: role,
    updatedBy: userId,
  });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/team/[memberId]
 *
 * Remove a team member. Admin/owner only.
 * Cannot remove the owner. Cannot remove yourself.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  const supabase = await createClient();
  const auth = await requireRole(supabase, ["owner", "admin"]);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  // Get the target member
  const { data: targetMember } = await supabase
    .from("business_members")
    .select("id, user_id, role, business_id")
    .eq("id", memberId)
    .eq("business_id", businessId)
    .single();

  if (!targetMember) {
    return NextResponse.json(
      { error: "Member not found" },
      { status: 404 }
    );
  }

  // Cannot remove the owner
  if (targetMember.role === "owner") {
    return NextResponse.json(
      { error: "Cannot remove the business owner" },
      { status: 403 }
    );
  }

  // Cannot remove yourself (use the self-remove path instead)
  if (targetMember.user_id === userId) {
    return NextResponse.json(
      { error: "You cannot remove yourself. Transfer ownership first." },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabase
    .from("business_members")
    .delete()
    .eq("id", memberId);

  if (deleteError) {
    log.error("Failed to remove team member", {
      memberId,
      error: deleteError.message,
    });
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }

  log.info("Team member removed", {
    businessId,
    memberId,
    removedBy: userId,
  });

  return NextResponse.json({ success: true });
}
