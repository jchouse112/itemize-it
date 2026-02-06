import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
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
  Wrench,
  HardHat,
  Building,
} from "lucide-react";
import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  color: string;
}

interface DashboardMetricsRpcRow {
  total_receipts: number | string | null;
  pending_receipts: number | string | null;
  total_spend_cents: number | string | null;
  business_spend_cents: number | string | null;
  business_items: number | string | null;
  material_cents: number | string | null;
  labour_cents: number | string | null;
  overhead_cents: number | string | null;
  personal_spend_cents: number | string | null;
  personal_items: number | string | null;
  unclassified_spend_cents: number | string | null;
  unclassified_items: number | string | null;
}

interface DashboardTopProjectRpcRow {
  id: string;
  name: string;
  budget_cents: number | null;
  material_target_percent: number | null;
  spend_cents: number | string | null;
  material_cents: number | string | null;
  labour_cents: number | string | null;
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

  // Use DB-side aggregate RPCs to avoid loading large item/receipt datasets.
  const [
    { data: metrics, error: metricsError },
    { data: topProjectsData, error: topProjectsError },
  ] = await Promise.all([
    supabase
      .rpc("get_ii_dashboard_metrics", { p_business_id: businessId })
      .single(),
    supabase
      .rpc("get_ii_dashboard_top_projects", {
        p_business_id: businessId,
        p_limit: 5,
      }),
  ]);

  if (metricsError) {
    console.error("Failed to load dashboard metrics:", metricsError.message);
  }
  if (topProjectsError) {
    console.error("Failed to load top projects:", topProjectsError.message);
  }

  const metricsRow = (metrics as DashboardMetricsRpcRow | null) ?? null;

  const totalReceipts = Number(metricsRow?.total_receipts ?? 0);
  const pendingReceipts = Number(metricsRow?.pending_receipts ?? 0);
  const totalSpendCents = Number(metricsRow?.total_spend_cents ?? 0);
  const businessSpendCents = Number(metricsRow?.business_spend_cents ?? 0);
  const businessItems = Number(metricsRow?.business_items ?? 0);
  const materialCents = Number(metricsRow?.material_cents ?? 0);
  const labourCents = Number(metricsRow?.labour_cents ?? 0);
  const overheadCents = Number(metricsRow?.overhead_cents ?? 0);
  const personalSpendCents = Number(metricsRow?.personal_spend_cents ?? 0);
  const personalItems = Number(metricsRow?.personal_items ?? 0);
  const unclassifiedSpendCents = Number(metricsRow?.unclassified_spend_cents ?? 0);
  const unclassifiedItems = Number(metricsRow?.unclassified_items ?? 0);

  const topProjects = ((topProjectsData as DashboardTopProjectRpcRow[] | null) ?? []).map((project) => ({
    ...project,
    spendCents: Number(project.spend_cents ?? 0),
    materialCents: Number(project.material_cents ?? 0),
    labourCents: Number(project.labour_cents ?? 0),
  }));

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

      {/* Business Expense Breakdown */}
      {businessSpendCents > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-concrete flex items-center gap-2 mb-4">
            <Briefcase className="w-4 h-4" />
            Business Breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gunmetal border border-edge-steel rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-concrete">Materials</span>
                <div className="w-7 h-7 rounded-lg bg-safety-orange/10 flex items-center justify-center">
                  <Wrench className="w-3.5 h-3.5 text-safety-orange" />
                </div>
              </div>
              <p className="text-lg font-bold text-white font-mono tabular-nums">
                {formatCents(materialCents, currency)}
              </p>
              {businessSpendCents > 0 && (
                <p className="text-[11px] text-concrete mt-0.5">
                  {Math.round((materialCents / businessSpendCents) * 100)}% of business
                </p>
              )}
            </div>
            <div className="bg-gunmetal border border-edge-steel rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-concrete">Labour</span>
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <HardHat className="w-3.5 h-3.5 text-blue-400" />
                </div>
              </div>
              <p className="text-lg font-bold text-white font-mono tabular-nums">
                {formatCents(labourCents, currency)}
              </p>
              {businessSpendCents > 0 && (
                <p className="text-[11px] text-concrete mt-0.5">
                  {Math.round((labourCents / businessSpendCents) * 100)}% of business
                </p>
              )}
            </div>
            <div className="bg-gunmetal border border-edge-steel rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-concrete">Overhead</span>
                <div className="w-7 h-7 rounded-lg bg-concrete/10 flex items-center justify-center">
                  <Building className="w-3.5 h-3.5 text-concrete" />
                </div>
              </div>
              <p className="text-lg font-bold text-white font-mono tabular-nums">
                {formatCents(overheadCents, currency)}
              </p>
              {businessSpendCents > 0 && (
                <p className="text-[11px] text-concrete mt-0.5">
                  {Math.round((overheadCents / businessSpendCents) * 100)}% of business
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
                  <th className="text-right text-concrete font-medium px-4 py-2.5 hidden lg:table-cell">Labour</th>
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
                        {project.materialCents > 0 ? (
                          <span className="text-xs font-mono tabular-nums text-safety-orange">
                            {formatCents(project.materialCents, currency)}
                          </span>
                        ) : (
                          <span className="text-concrete/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right hidden lg:table-cell">
                        {project.labourCents > 0 ? (
                          <span className="text-xs font-mono tabular-nums text-blue-400">
                            {formatCents(project.labourCents, currency)}
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
