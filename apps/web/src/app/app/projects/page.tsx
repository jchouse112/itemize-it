"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  X,
  Loader2,
  Archive,
  CheckCircle,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import type { IIProject, ProjectStatus } from "@/lib/ii-types";
import { formatCents } from "@/lib/ii-utils";

interface ProjectWithStats extends IIProject {
  item_count: number;
  total_cents: number;
  business_cents: number;
}

const STATUS_BADGE: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  active: { label: "Active", className: "bg-safe/10 text-safe" },
  completed: { label: "Completed", className: "bg-concrete/20 text-concrete" },
  archived: { label: "Archived", className: "bg-edge-steel text-concrete/60" },
};

/** Skeleton placeholder for project cards */
function ProjectsSkeleton() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-edge-steel rounded animate-pulse" />
        <div className="h-9 w-28 bg-edge-steel rounded-lg animate-pulse" />
      </div>

      {/* Filters skeleton */}
      <div className="flex gap-2 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-7 w-20 bg-edge-steel/60 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Project cards grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-gunmetal border border-edge-steel rounded-xl p-5 animate-pulse"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="h-5 w-32 bg-edge-steel rounded mb-2" />
                <div className="h-3 w-20 bg-edge-steel/60 rounded" />
              </div>
              <div className="h-5 w-16 bg-edge-steel/60 rounded" />
            </div>
            <div className="h-4 w-full bg-edge-steel/40 rounded mb-3" />
            <div className="flex items-center gap-4">
              <div className="h-4 w-20 bg-edge-steel rounded" />
              <div className="h-4 w-16 bg-edge-steel/60 rounded" />
            </div>
            {/* Budget bar skeleton (show on some cards) */}
            {i % 2 === 0 && (
              <div className="mt-3">
                <div className="flex justify-between mb-1">
                  <div className="h-3 w-12 bg-edge-steel/60 rounded" />
                  <div className="h-3 w-24 bg-edge-steel/60 rounded" />
                </div>
                <div className="h-1.5 bg-edge-steel rounded-full" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | ProjectStatus>("all");

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [budgetDollars, setBudgetDollars] = useState("");
  const [materialTarget, setMaterialTarget] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadProjects() {
    setError(null);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects ?? []);
      } else {
        setError("Failed to load projects.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        client_name: clientName.trim() || null,
        budget_cents: budgetDollars
          ? Math.round(parseFloat(budgetDollars) * 100)
          : null,
        material_target_percent: materialTarget
          ? parseInt(materialTarget, 10)
          : null,
      }),
    });

    if (res.ok) {
      setName("");
      setDescription("");
      setClientName("");
      setBudgetDollars("");
      setMaterialTarget("");
      setShowCreate(false);
      await loadProjects();
    } else {
      setError("Failed to create project. Please try again.");
    }
    setCreating(false);
  }

  const filtered =
    filter === "all"
      ? projects
      : projects.filter((p) => p.status === filter);

  if (loading) {
    return <ProjectsSkeleton />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Projects</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 text-sm bg-safety-orange hover:bg-safety-orange/90 text-white font-semibold rounded-lg px-4 py-2 transition-colors"
        >
          {showCreate ? (
            <X className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {showCreate ? "Cancel" : "New Project"}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 bg-critical/10 border border-critical/20 rounded-lg p-3 text-sm text-critical mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-gunmetal border border-edge-steel rounded-xl p-5 mb-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-concrete mb-1">
                Project Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Kitchen Remodel"
                className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm placeholder:text-concrete/40 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
              />
            </div>
            <div>
              <label className="block text-xs text-concrete mb-1">
                Client Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Optional"
                className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm placeholder:text-concrete/40 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-concrete mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="w-full bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm placeholder:text-concrete/40 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
            />
          </div>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-concrete mb-1">
                Budget{" "}
                <span className="text-concrete/60">(incl. taxes)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={budgetDollars}
                onChange={(e) => setBudgetDollars(e.target.value)}
                placeholder="$0.00"
                className="w-40 bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-concrete/40 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
              />
            </div>
            <div>
              <label className="block text-xs text-concrete mb-1">
                Material Target %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={materialTarget}
                onChange={(e) => setMaterialTarget(e.target.value)}
                placeholder="40"
                className="w-24 bg-asphalt border border-edge-steel rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-concrete/40 focus:outline-none focus:ring-2 focus:ring-safety-orange/50 focus:border-safety-orange"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="flex items-center gap-2 bg-safety-orange hover:bg-safety-orange/90 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 transition-colors"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create Project
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(["all", "active", "completed", "archived"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              filter === f
                ? "bg-safety-orange/10 text-safety-orange"
                : "text-concrete hover:text-white hover:bg-edge-steel/40"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Projects list */}
      {filtered.length === 0 ? (
        <div className="bg-gunmetal border border-edge-steel rounded-xl p-12 text-center">
          <FolderKanban className="w-12 h-12 text-concrete/40 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">
            {projects.length === 0 ? "No projects yet" : "No matching projects"}
          </h2>
          <p className="text-concrete text-sm max-w-md mx-auto">
            {projects.length === 0
              ? "Create a project to start organizing expenses by job, client, or purpose."
              : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const badge = STATUS_BADGE[project.status];
            const budgetUsed =
              project.budget_cents && project.budget_cents > 0
                ? Math.min(
                    (project.total_cents / project.budget_cents) * 100,
                    100
                  )
                : null;

            return (
              <Link
                key={project.id}
                href={`/app/projects/${project.id}`}
                className="bg-gunmetal border border-edge-steel rounded-xl p-5 hover:border-safety-orange/30 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold group-hover:text-safety-orange transition-colors">
                      {project.name}
                    </h3>
                    {project.client_name && (
                      <p className="text-xs text-concrete mt-0.5">
                        {project.client_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-concrete/40 group-hover:text-safety-orange transition-colors" />
                  </div>
                </div>

                {project.description && (
                  <p className="text-xs text-concrete mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-concrete">
                  <span className="font-mono tabular-nums">
                    {formatCents(project.total_cents)} spent
                  </span>
                  <span>{project.item_count} items</span>
                </div>

                {budgetUsed !== null && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-concrete mb-1">
                      <span>Budget</span>
                      <span className="font-mono tabular-nums">
                        {formatCents(project.total_cents)} /{" "}
                        {formatCents(project.budget_cents!)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-edge-steel rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          budgetUsed > 90
                            ? "bg-critical"
                            : budgetUsed > 70
                              ? "bg-warn"
                              : "bg-safe"
                        }`}
                        style={{ width: `${budgetUsed}%` }}
                      />
                    </div>
                  </div>
                )}

                {project.material_target_percent !== null && budgetUsed !== null && (
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-concrete">Materials</span>
                    <span className="font-mono tabular-nums">
                      <span className="text-safety-orange">
                        Target {project.material_target_percent}%
                      </span>
                      <span className="text-concrete mx-1">/</span>
                      <span
                        className={
                          budgetUsed <= project.material_target_percent
                            ? "text-safe"
                            : budgetUsed <= project.material_target_percent * 1.1
                              ? "text-warn"
                              : "text-critical"
                        }
                      >
                        Current {Math.round(budgetUsed)}%
                      </span>
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
