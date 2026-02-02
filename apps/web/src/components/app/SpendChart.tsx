"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

// Colors from the Precision Industrial dark theme
const COLORS = {
  orange: "#F57C20",
  green: "#22C55E",
  concrete: "#9CA3AF",
  steel: "#374151",
  white: "#FFFFFF",
  warn: "#EAB308",
  critical: "#EF4444",
};

const PIE_COLORS = [COLORS.orange, COLORS.green, COLORS.concrete, COLORS.warn, COLORS.critical, "#8B5CF6", "#06B6D4"];

interface SpendDataItem {
  label: string;
  cents: number;
}

interface MonthlySpendItem {
  month: string;
  businessCents: number;
  personalCents: number;
  totalCents: number;
}

interface SpendChartProps {
  byCategoryData: SpendDataItem[];
  byProjectData: SpendDataItem[];
  monthlyData: MonthlySpendItem[];
  topMerchants: SpendDataItem[];
  currency?: string;
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gunmetal border border-edge-steel rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="text-concrete text-xs mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-mono tabular-nums">
          {entry.name}: ${(entry.value / 100).toFixed(2)}
        </p>
      ))}
    </div>
  );
}

export default function SpendChart({
  byCategoryData,
  byProjectData,
  monthlyData,
  topMerchants,
  currency = "USD",
}: SpendChartProps) {
  // Format category labels
  const categoryChartData = useMemo(
    () =>
      byCategoryData
        .sort((a, b) => b.cents - a.cents)
        .slice(0, 10)
        .map((d) => ({
          name: d.label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          value: d.cents,
        })),
    [byCategoryData]
  );

  const projectChartData = useMemo(
    () =>
      byProjectData
        .sort((a, b) => b.cents - a.cents)
        .slice(0, 8)
        .map((d) => ({
          name: d.label.length > 20 ? d.label.slice(0, 18) + "…" : d.label,
          value: d.cents,
        })),
    [byProjectData]
  );

  const merchantData = useMemo(
    () =>
      topMerchants
        .sort((a, b) => b.cents - a.cents)
        .slice(0, 8)
        .map((d) => ({
          name: d.label.length > 25 ? d.label.slice(0, 23) + "…" : d.label,
          value: d.cents,
        })),
    [topMerchants]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Monthly trend */}
      {monthlyData.length > 0 && (
        <div className="lg:col-span-2 bg-gunmetal border border-edge-steel rounded-xl p-5">
          <h3 className="text-sm font-medium text-concrete mb-4">Monthly Spend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.steel} />
              <XAxis dataKey="month" tick={{ fill: COLORS.concrete, fontSize: 12 }} />
              <YAxis tickFormatter={formatDollars} tick={{ fill: COLORS.concrete, fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: COLORS.concrete }}
              />
              <Line
                type="monotone"
                dataKey="businessCents"
                name="Business"
                stroke={COLORS.green}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="personalCents"
                name="Personal"
                stroke={COLORS.concrete}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="totalCents"
                name="Total"
                stroke={COLORS.orange}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Spend by tax category (pie) */}
      {categoryChartData.length > 0 && (
        <div className="bg-gunmetal border border-edge-steel rounded-xl p-5">
          <h3 className="text-sm font-medium text-concrete mb-4">Spend by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categoryChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`
                }
                labelLine={{ stroke: COLORS.concrete }}
              >
                {categoryChartData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: unknown) => `$${(Number(value) / 100).toFixed(2)}`}
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "1px solid #374151",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Spend by project (bar) */}
      {projectChartData.length > 0 && (
        <div className="bg-gunmetal border border-edge-steel rounded-xl p-5">
          <h3 className="text-sm font-medium text-concrete mb-4">Spend by Project</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={projectChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.steel} />
              <XAxis type="number" tickFormatter={formatDollars} tick={{ fill: COLORS.concrete, fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: COLORS.concrete, fontSize: 11 }} />
              <Tooltip
                formatter={(value: unknown) => `$${(Number(value) / 100).toFixed(2)}`}
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "1px solid #374151",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill={COLORS.orange} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top merchants table */}
      {merchantData.length > 0 && (
        <div className="lg:col-span-2 bg-gunmetal border border-edge-steel rounded-xl p-5">
          <h3 className="text-sm font-medium text-concrete mb-4">Top Merchants</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge-steel">
                  <th className="text-left text-concrete font-medium px-4 py-2">Merchant</th>
                  <th className="text-right text-concrete font-medium px-4 py-2">Total Spend</th>
                  <th className="text-right text-concrete font-medium px-4 py-2">Share</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const grandTotal = merchantData.reduce((s, m) => s + m.value, 0);
                  return merchantData.map((m, i) => (
                    <tr key={i} className="border-b border-edge-steel/50 last:border-0">
                      <td className="px-4 py-2 text-white">{m.name}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-white">
                        ${(m.value / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right text-concrete">
                        {grandTotal > 0 ? ((m.value / grandTotal) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
