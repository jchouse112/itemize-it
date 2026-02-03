import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { formatCents } from "@/lib/ii-utils";
import {
  DollarSign,
  Briefcase,
  ShoppingBag,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  FolderOpen,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, subtext, icon, color }: StatCardProps) {
  return (
    <div className="bg-gunmetal border border-edge-steel rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-concrete">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-white font-mono tabular-nums">
        {value}
      </p>
      {subtext && <p className="text-xs text-concrete mt-1">{subtext}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get user's business membership and currency
  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id, businesses(default_currency)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership) {
    redirect("/onboarding");
  }

  const businessId = membership.business_id;
  const currency =
    (membership.businesses as unknown as { default_currency: string })
      ?.default_currency ?? "USD";

  // Parallelize all dashboard queries
  const [
    { count: totalReceipts },
    { count: pendingReceipts },
    { data: spendData },
    { data: businessItemsData },
    { data: personalItemsData },
    { data: unclassifiedItemsData },
    { data: projectsData },
    { data: projectItemsData },
  ] = await Promise.all([
    supabase
      .from("ii_receipts")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("ii_receipts")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["pending", "in_review"]),
    supabase
      .from("ii_receipts")
      .select("total_cents")
      .eq("business_id", businessId)
      .eq("status", "complete"),
    supabase
      .from("ii_receipt_items")
      .select("total_price_cents")
      .eq("business_id", businessId)
      .eq("classification", "business"),
    supabase
      .from("ii_receipt_items")
      .select("total_price_cents")
      .eq("business_id", businessId)
      .eq("classification", "personal"),
    supabase
      .from("ii_receipt_items")
      .select("total_price_cents")
      .eq("business_id", businessId)
      .eq("classification", "unclassified"),
    supabase
      .from("ii_projects")
      .select("id, name, status, budget_cents, material_target_percent")
      .eq("business_id", businessId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("ii_receipt_items")
      .select("project_id, total_price_cents")
      .eq("business_id", businessId)
      .not("project_id", "is", null),
  ]);

  const totalSpendCents =
    spendData?.reduce((sum, r) => sum + (r.total_cents ?? 0), 0) ?? 0;

  const businessSpendCents =
    businessItemsData?.reduce((sum, i) => sum + (i.total_price_cents ?? 0), 0) ?? 0;
  const businessItems = businessItemsData?.length ?? 0;

  const personalSpendCents =
    personalItemsData?.reduce((sum, i) => sum + (i.total_price_cents ?? 0), 0) ?? 0;
  const personalItems = personalItemsData?.length ?? 0;

  const unclassifiedSpendCents =
    unclassifiedItemsData?.reduce((sum, i) => sum + (i.total_price_cents ?? 0), 0) ?? 0;
  const unclassifiedItems = unclassifiedItemsData?.length ?? 0;

  // Aggregate spend by project
  const projectSpendMap = new Map<string, number>();
  for (const item of projectItemsData ?? []) {
    if (item.project_id) {
      projectSpendMap.set(
        item.project_id,
        (projectSpendMap.get(item.project_id) ?? 0) + (item.total_price_cents ?? 0)
      );
    }
  }

  const topProjects = (projectsData ?? [])
    .map((p) => ({
      ...p,
      spendCents: projectSpendMap.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.spendCents - a.spendCents)
    .slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <Link
          href="/app/receipts"
          className="flex items-center gap-1.5 text-sm text-safety-orange hover:underline"
        >
          View all receipts
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Total Spend"
          value={formatCents(totalSpendCents, currency)}
          subtext={`${totalReceipts ?? 0} receipts`}
          icon={<DollarSign className="w-5 h-5 text-safety-orange" />}
          color="bg-safety-orange/10"
        />
        <StatCard
          label="Business"
          value={formatCents(businessSpendCents, currency)}
          subtext={`${businessItems} items`}
          icon={<Briefcase className="w-5 h-5 text-safe" />}
          color="bg-safe/10"
        />
        <StatCard
          label="Personal"
          value={formatCents(personalSpendCents, currency)}
          subtext={`${personalItems} items`}
          icon={<ShoppingBag className="w-5 h-5 text-concrete" />}
          color="bg-edge-steel/50"
        />
        <StatCard
          label="Unclassified"
          value={formatCents(unclassifiedSpendCents, currency)}
          subtext={`${unclassifiedItems} items`}
          icon={<HelpCircle className="w-5 h-5 text-safety-orange/70" />}
          color="bg-safety-orange/5"
        />
        <StatCard
          label="Needs Review"
          value={String(pendingReceipts ?? 0)}
          icon={<AlertTriangle className="w-5 h-5 text-warn" />}
          color="bg-warn/10"
        />
      </div>

      {/* Top Projects */}
      {topProjects.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-concrete flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Active Projects
            </h2>
            <Link
              href="/app/projects"
              className="text-xs text-safety-orange hover:underline flex items-center gap-1"
            >
              View all
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="bg-gunmetal border border-edge-steel rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge-steel">
                  <th className="text-left text-concrete font-medium px-4 py-2.5">Project</th>
                  <th className="text-right text-concrete font-medium px-4 py-2.5">Spend</th>
                  <th className="text-right text-concrete font-medium px-4 py-2.5 hidden sm:table-cell">Budget</th>
                  <th className="text-right text-concrete font-medium px-4 py-2.5 hidden md:table-cell">Material</th>
                </tr>
              </thead>
              <tbody>
                {topProjects.map((project) => {
                  const budgetPct = project.budget_cents && project.budget_cents > 0
                    ? Math.min((project.spendCents / project.budget_cents) * 100, 100)
                    : null;
                  return (
                    <tr key={project.id} className="border-b border-edge-steel/50 last:border-0 hover:bg-edge-steel/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link href={`/app/projects/${project.id}`} className="text-white font-medium hover:text-safety-orange transition-colors">
                          {project.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-white">
                        {formatCents(project.spendCents, currency)}
                      </td>
                      <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                        {project.budget_cents ? (
                          <span className={`text-xs font-mono tabular-nums ${
                            budgetPct != null && budgetPct > 90 ? "text-critical" : budgetPct != null && budgetPct > 70 ? "text-warn" : "text-concrete"
                          }`}>
                            {formatCents(project.budget_cents, currency)}
                            {budgetPct != null && ` (${Math.round(budgetPct)}%)`}
                          </span>
                        ) : (
                          <span className="text-concrete/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right hidden md:table-cell">
                        {project.material_target_percent != null && budgetPct != null ? (
                          <span className="text-xs font-mono tabular-nums">
                            <span className="text-safety-orange">
                              {project.material_target_percent}%
                            </span>
                            <span className="text-concrete mx-0.5">/</span>
                            <span
                              className={
                                budgetPct <= project.material_target_percent
                                  ? "text-safe"
                                  : budgetPct <= project.material_target_percent * 1.1
                                    ? "text-warn"
                                    : "text-critical"
                              }
                            >
                              {Math.round(budgetPct)}%
                            </span>
                          </span>
                        ) : (
                          <span className="text-concrete/40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Connect to Brian */}
      <div className="mb-8">
        <a
          href="https://bookkeeperbrian.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-gunmetal border border-violet-600/30 rounded-xl p-6 hover:border-violet-500/50 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <div>
                <h3 className="text-white font-semibold group-hover:text-violet-400 transition-colors">
                  Need more than expense tracking? Meet Brian.
                </h3>
                <p className="text-concrete text-sm mt-0.5">
                  Turn your receipts into close-ready books with automated categorization, HST tracking, and monthly close packages.
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-violet-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </a>
      </div>

      {/* Empty state */}
      {(totalReceipts ?? 0) === 0 && (
        <div className="bg-gunmetal border border-edge-steel rounded-xl p-12 text-center">
          <Receipt className="w-12 h-12 text-concrete/40 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">
            No receipts yet
          </h2>
          <p className="text-concrete text-sm mb-6 max-w-md mx-auto">
            Upload your first receipt to start organizing your expenses. You can
            take a photo, upload a file, or forward emails.
          </p>
          <Link
            href="/app/receipts"
            className="inline-flex items-center gap-2 bg-safety-orange hover:bg-safety-orange/90 text-white font-semibold rounded-lg px-5 py-2.5 transition-colors"
          >
            <Receipt className="w-4 h-4" />
            Upload a Receipt
          </Link>
        </div>
      )}
    </div>
  );
}
