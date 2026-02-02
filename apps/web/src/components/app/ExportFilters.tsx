"use client";

import { useState, useEffect } from "react";
import { Calendar, FolderKanban, Tag, Download, FileArchive } from "lucide-react";
import type { IIProject } from "@/lib/ii-types";

export interface ExportFilterValues {
  dateFrom: string;
  dateTo: string;
  projectId: string; // "" = all
  classifications: string[]; // empty = all
  format: "csv" | "accountant-pack";
}

interface ExportFiltersProps {
  projects: Pick<IIProject, "id" | "name" | "status">[];
  onExport: (filters: ExportFilterValues) => void;
  loading: boolean;
}

const CLASSIFICATION_OPTIONS = [
  { value: "business", label: "Business" },
  { value: "personal", label: "Personal" },
  { value: "unclassified", label: "Unclassified" },
];

function defaultDateFrom(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function defaultDateTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ExportFilters({ projects, onExport, loading }: ExportFiltersProps) {
  const [filters, setFilters] = useState<ExportFilterValues>({
    dateFrom: defaultDateFrom(),
    dateTo: defaultDateTo(),
    projectId: "",
    classifications: [],
    format: "csv",
  });

  function toggleClassification(value: string) {
    setFilters((prev) => ({
      ...prev,
      classifications: prev.classifications.includes(value)
        ? prev.classifications.filter((c) => c !== value)
        : [...prev.classifications, value],
    }));
  }

  const dateRangeInvalid = filters.dateFrom > filters.dateTo;

  return (
    <div className="bg-gunmetal border border-edge-steel rounded-xl p-6 space-y-6">
      {/* Date range */}
      <div>
        <label className="text-sm font-medium text-concrete flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4" />
          Date Range
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className={`bg-asphalt border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-safety-orange ${
              dateRangeInvalid ? "border-critical" : "border-edge-steel"
            }`}
          />
          <span className="text-concrete text-sm">to</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className={`bg-asphalt border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-safety-orange ${
              dateRangeInvalid ? "border-critical" : "border-edge-steel"
            }`}
          />
        </div>
        {dateRangeInvalid && (
          <p className="text-xs text-critical mt-1.5">Start date must be on or before end date</p>
        )}
      </div>

      {/* Project filter */}
      <div>
        <label className="text-sm font-medium text-concrete flex items-center gap-2 mb-3">
          <FolderKanban className="w-4 h-4" />
          Project
        </label>
        <select
          value={filters.projectId}
          onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value }))}
          className="bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-sm text-white w-full max-w-xs focus:outline-none focus:border-safety-orange"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Classification filter */}
      <div>
        <label className="text-sm font-medium text-concrete flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4" />
          Classification
        </label>
        <div className="flex flex-wrap gap-2">
          {CLASSIFICATION_OPTIONS.map((opt) => {
            const selected = filters.classifications.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleClassification(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  selected
                    ? "bg-safety-orange/10 border-safety-orange text-safety-orange"
                    : "bg-asphalt border-edge-steel text-concrete hover:text-white hover:border-concrete"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          {filters.classifications.length > 0 && (
            <button
              onClick={() => setFilters((f) => ({ ...f, classifications: [] }))}
              className="px-3 py-1.5 rounded-lg text-sm text-concrete hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        {filters.classifications.length === 0 && (
          <p className="text-xs text-concrete/60 mt-1.5">All classifications included</p>
        )}
      </div>

      {/* Export format + button */}
      <div className="flex flex-wrap items-end gap-4 pt-2 border-t border-edge-steel">
        <div>
          <label className="text-sm font-medium text-concrete mb-3 block">Format</label>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters((f) => ({ ...f, format: "csv" }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                filters.format === "csv"
                  ? "bg-safety-orange/10 border-safety-orange text-safety-orange"
                  : "bg-asphalt border-edge-steel text-concrete hover:text-white"
              }`}
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={() => setFilters((f) => ({ ...f, format: "accountant-pack" }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                filters.format === "accountant-pack"
                  ? "bg-safety-orange/10 border-safety-orange text-safety-orange"
                  : "bg-asphalt border-edge-steel text-concrete hover:text-white"
              }`}
            >
              <FileArchive className="w-4 h-4" />
              Accountant Pack
            </button>
          </div>
        </div>

        <button
          onClick={() => onExport(filters)}
          disabled={loading || dateRangeInvalid}
          className="ml-auto flex items-center gap-2 bg-safety-orange hover:bg-safety-orange/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-2.5 transition-colors"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Exporting…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export
            </>
          )}
        </button>
      </div>
    </div>
  );
}
