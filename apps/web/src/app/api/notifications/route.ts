import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";
import { NotificationReadSchema, NotificationBulkReadSchema } from "@/lib/validation";

/**
 * GET /api/notifications — list notifications for the current user.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "No active business" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("ii_notifications")
    .select("*")
    .eq("business_id", membership.business_id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    log.error("Failed to fetch notifications", { error: error.message });
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/notifications — mark a notification as read.
 * Body: { id: string, read: boolean }
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "No active business" }, { status: 403 });
  }

  const body = await request.json();

  // Try bulk schema first (has `ids`), then single schema (has `id`)
  const bulkParsed = NotificationBulkReadSchema.safeParse(body);
  if (bulkParsed.success) {
    const { ids, read } = bulkParsed.data;

    const { error } = await supabase
      .from("ii_notifications")
      .update({ read })
      .in("id", ids)
      .eq("user_id", user.id)
      .eq("business_id", membership.business_id);

    if (error) {
      log.error("Failed to bulk update notifications", { error: error.message });
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // Single update: { id: "...", read: true }
  const singleParsed = NotificationReadSchema.safeParse(body);
  if (!singleParsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: singleParsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { id, read } = singleParsed.data;

  const { error } = await supabase
    .from("ii_notifications")
    .update({ read })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("business_id", membership.business_id);

  if (error) {
    log.error("Failed to update notification", { error: error.message });
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
