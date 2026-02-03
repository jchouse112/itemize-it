import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-helpers";
import { z } from "zod";

const FeedbackSchema = z.object({
  feedback_type: z.enum(["enhancement", "bug", "general"]),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
  page_url: z.string().max(500).optional(),
});

/** POST /api/feedback — Submit user feedback */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if ("error" in auth) return auth.error;
  const { userId, businessId } = auth.ctx;

  const body = await request.json();
  const parsed = FeedbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { feedback_type, message, page_url } = parsed.data;

  // Get user agent from request headers
  const userAgent = request.headers.get("user-agent") ?? null;

  const { data: feedback, error } = await supabase
    .from("ii_feedback")
    .insert({
      user_id: userId,
      business_id: businessId,
      feedback_type,
      message: message.trim(),
      page_url: page_url ?? null,
      user_agent: userAgent,
    })
    .select("id, feedback_type, created_at")
    .single();

  if (error) {
    console.error("Failed to submit feedback:", error.message);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }

  return NextResponse.json({ feedback, success: true }, { status: 201 });
}

