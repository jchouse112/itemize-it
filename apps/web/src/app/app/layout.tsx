import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/app/Sidebar";
import TopBar from "@/components/app/TopBar";
import { canUploadReceipt } from "@/lib/plan-gate";
import type { PlanTier } from "@/lib/ii-types";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get user's active business membership
  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id, businesses(name, plan_tier)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  // If no business, send to onboarding (unless already there)
  if (!membership) {
    redirect("/onboarding");
  }

  const business = membership.businesses as unknown as {
    name: string;
    plan_tier: PlanTier;
  };
  const businessName = business?.name ?? "My Business";
  const planTier: PlanTier = business?.plan_tier ?? "free";
  const businessId = membership.business_id;

  const usage = await canUploadReceipt(businessId, supabase);

  return (
    <div className="flex h-screen bg-asphalt overflow-hidden">
      <Sidebar planTier={planTier} receiptsUsed={usage.used} receiptsLimit={usage.limit} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar userEmail={user.email ?? ""} businessName={businessName} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
