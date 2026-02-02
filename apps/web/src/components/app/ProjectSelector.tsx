"use client";

import { useState, useEffect, useRef } from "react";
import { FolderKanban, ChevronDown, X, Plus } from "lucide-react";
import Link from "next/link";
import { useProjectCache } from "./ProjectCacheProvider";

interface ProjectSelectorProps {
  value: string | null;
  onChange: (projectId: string | null) => void;
  disabled?: boolean;
}

export default function ProjectSelector({
  value,
  onChange,
  disabled,
}: ProjectSelectorProps) {
  const { projects, ensureLoaded } = useProjectCache();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Trigger a single shared fetch when the dropdown is first opened
  useEffect(() => {
    if (open) ensureLoaded();
  }, [open, ensureLoaded]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedProject = projects.find((p) => p.id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-transparent text-concrete/60 hover:text-concrete hover:bg-edge-steel/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed max-w-[120px]"
      >
        <FolderKanban className="w-3 h-3 shrink-0" />
        <span className="truncate">
          {selectedProject ? selectedProject.name : "Project"}
        </span>
        {value ? (
          <X
            className="w-3 h-3 shrink-0 hover:text-critical"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          />
        ) : (
          <ChevronDown className="w-3 h-3 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-gunmetal border border-edge-steel rounded-lg shadow-xl min-w-[160px] py-1">
          {projects.length === 0 ? (
            <div className="px-3 py-2 text-xs text-concrete/60">
              No active projects
              <Link
                href="/app/projects"
                className="flex items-center gap-1 mt-1.5 text-safety-orange hover:text-safety-orange/80 transition-colors"
                onClick={() => setOpen(false)}
              >
                <Plus className="w-3 h-3" />
                Create project
              </Link>
            </div>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  p.id === value
                    ? "bg-safety-orange/10 text-safety-orange"
                    : "text-concrete hover:text-white hover:bg-edge-steel/40"
                }`}
              >
                {p.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
