import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickSafeRedirectPath } from "@/lib/redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = pickSafeRedirectPath([searchParams.get("next")]);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has a business — if not, redirect to onboarding
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: membership } = await supabase
          .from("business_members")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .single();

        if (!membership) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth code exchange failed — send back to login
  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
}
