"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, FileArchive, BarChart3, AlertTriangle } from "lucide-react";
import ExportFilters, { type ExportFilterValues } from "@/components/app/ExportFilters";
import SpendChart from "@/components/app/SpendChart";
import { formatCents } from "@/lib/ii-utils";

import type { ProjectStatus } from "@/lib/ii-types";

interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
}

interface ReportData {
  byCategoryData: { label: string; cents: number }[];
  byProjectData: { label: string; cents: number }[];
  monthlyData: { month: string; businessCents: number; personalCents: number; totalCents: number }[];
  topMerchants: { label: string; cents: number }[];
  totalItemsCents: number;
  totalItemCount: number;
  receiptCount: number;
  exportedReceiptCount: number;
}

export default function ExportsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showReExportWarning, setShowReExportWarning] = useState(false);
  const [pendingExportFilters, setPendingExportFilters] = useState<ExportFilterValues | null>(null);

  // Load projects on mount
  useEffect(() => {
    async function loadProjects() {
      const res = await fetch("/api/projects?status=active");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects ?? []);
      }
    }
    loadProjects();
  }, []);

  // Load report data whenever filters are set
  const loadReportData = useCallback(async (filters: ExportFilterValues) => {
    setReportLoading(true);
    try {
      const res = await fetch("/api/exports/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          projectId: filters.projectId || undefined,
          classifications:
            filters.classifications.length > 0
              ? filters.classifications
              : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to load report data" }));
        console.error("Failed to load report data", data.error ?? res.status);
        setReportData(null);
        return;
      }

      const data = await res.json();
      setReportData(data.report ?? null);
    } catch (err) {
      console.error("Failed to load report data", err);
    } finally {
      setReportLoading(false);
    }
  }, []);

  function requestExport(filters: ExportFilterValues) {
    // Warn if there are already-exported receipts in the range
    if (reportData && reportData.exportedReceiptCount > 0) {
      setPendingExportFilters(filters);
      setShowReExportWarning(true);
      return;
    }
    handleExport(filters);
  }

  function confirmReExport() {
    setShowReExportWarning(false);
    if (pendingExportFilters) {
      handleExport(pendingExportFilters);
      setPendingExportFilters(null);
    }
  }

  function cancelReExport() {
    setShowReExportWarning(false);
    setPendingExportFilters(null);
  }

  async function handleExport(filters: ExportFilterValues) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const endpoint =
      filters.format === "csv"
        ? "/api/exports/csv"
        : "/api/exports/accountant-pack";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          projectId: filters.projectId || undefined,
          classifications: filters.classifications.length > 0 ? filters.classifications : undefined,
          markExported: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Export failed" }));
        setError(data.error ?? "Export failed");
        return;
      }

      // Download the file
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `export.${filters.format === "csv" ? "csv" : "zip"}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const truncated = res.headers.get("X-Export-Truncated") === "true";
      const limit = res.headers.get("X-Export-Limit");
      const truncationNote = truncated
        ? ` (capped at ${limit ?? "10,000"} items — narrow the date range for a complete export)`
        : "";

      setSuccess(
        filters.format === "csv"
          ? `CSV downloaded successfully${truncationNote}`
          : `Accountant pack downloaded successfully${truncationNote}`
      );

      // Refresh report data to show updated export status
      loadReportData(filters);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Load report when page first renders with default filters
  useEffect(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const dateFrom = d.toISOString().slice(0, 10);
    const dateTo = new Date().toISOString().slice(0, 10);
    loadReportData({
      dateFrom,
      dateTo,
      projectId: "",
      classifications: [],
      format: "csv",
    });
  }, [loadReportData]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Exports & Reports</h1>
      </div>

      {/* Export filters */}
      <ExportFilters
        projects={projects}
        onExport={(filters) => {
          loadReportData(filters);
          requestExport(filters);
        }}
        loading={loading}
      />

      {/* Status messages */}
      {error && (
        <div className="mt-4 bg-critical/10 border border-critical/30 rounded-lg px-4 py-3 text-sm text-critical flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 bg-safe/10 border border-safe/30 rounded-lg px-4 py-3 text-sm text-safe flex items-center gap-2">
          <Download className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Re-export warning dialog */}
      {showReExportWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gunmetal border border-edge-steel rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-warn shrink-0 mt-0.5" />
              <div>
                <h3 className="text-white font-semibold">Re-export warning</h3>
                <p className="text-concrete text-sm mt-1">
                  {reportData?.exportedReceiptCount} of {reportData?.receiptCount} receipts
                  in this range have already been exported. Continuing will include
                  previously exported data.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelReExport}
                className="px-4 py-2 rounded-lg text-sm font-medium text-concrete hover:text-white border border-edge-steel hover:border-concrete transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReExport}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-safety-orange hover:bg-safety-orange/90 text-white transition-colors"
              >
                Export anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      {reportData && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gunmetal border border-edge-steel rounded-xl p-4">
            <p className="text-xs text-concrete mb-1">Receipts</p>
            <p className="text-xl font-bold text-white font-mono tabular-nums">
              {reportData.receiptCount}
            </p>
          </div>
          <div className="bg-gunmetal border border-edge-steel rounded-xl p-4">
            <p className="text-xs text-concrete mb-1">Line Items</p>
            <p className="text-xl font-bold text-white font-mono tabular-nums">
              {reportData.totalItemCount}
            </p>
          </div>
          <div className="bg-gunmetal border border-edge-steel rounded-xl p-4">
            <p className="text-xs text-concrete mb-1">Total Spend</p>
            <p className="text-xl font-bold text-white font-mono tabular-nums">
              {formatCents(reportData.totalItemsCents)}
            </p>
          </div>
          <div className="bg-gunmetal border border-edge-steel rounded-xl p-4">
            <p className="text-xs text-concrete mb-1">Already Exported</p>
            <p className="text-xl font-bold text-white font-mono tabular-nums">
              {reportData.exportedReceiptCount}
              {reportData.exportedReceiptCount > 0 && (
                <span className="text-xs text-concrete font-normal ml-1">
                  / {reportData.receiptCount}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      {reportLoading && (
        <div className="mt-8 text-center py-12">
          <div className="w-8 h-8 border-2 border-safety-orange/30 border-t-safety-orange rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-concrete">Loading report data…</p>
        </div>
      )}

      {!reportLoading && reportData && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-concrete flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4" />
            Spend Analysis
          </h2>
          <SpendChart
            byCategoryData={reportData.byCategoryData}
            byProjectData={reportData.byProjectData}
            monthlyData={reportData.monthlyData}
            topMerchants={reportData.topMerchants}
          />
        </div>
      )}

      {!reportLoading && !reportData && (
        <div className="mt-8 bg-gunmetal border border-edge-steel rounded-xl p-12 text-center">
          <BarChart3 className="w-12 h-12 text-concrete/40 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No data for this period</h2>
          <p className="text-concrete text-sm max-w-md mx-auto">
            Adjust the date range or filters above to see spending reports and export data.
          </p>
        </div>
      )}
    </div>
  );
}
