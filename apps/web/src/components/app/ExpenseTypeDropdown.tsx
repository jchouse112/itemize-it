"use client";

import { useState, useEffect, useRef } from "react";
import type { ExpenseType } from "@/lib/ii-types";
import { Wrench, HardHat, Building, ChevronDown } from "lucide-react";

interface ExpenseTypeDropdownProps {
  value: ExpenseType;
  onChange: (value: ExpenseType) => void;
  disabled?: boolean;
}

const OPTIONS: {
  value: ExpenseType;
  label: string;
  icon: typeof Wrench;
}[] = [
  {
    value: "material",
    label: "Material",
    icon: Wrench,
  },
  {
    value: "labour",
    label: "Labour",
    icon: HardHat,
  },
  {
    value: "overhead",
    label: "Overhead",
    icon: Building,
  },
];

export default function ExpenseTypeDropdown({
  value,
  onChange,
  disabled,
}: ExpenseTypeDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const selectedOption = OPTIONS.find((opt) => opt.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-transparent text-concrete/60 hover:text-concrete hover:bg-edge-steel/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {selectedOption && <selectedOption.icon className="w-3 h-3 shrink-0" />}
        <span className="truncate">{selectedOption?.label ?? "Type"}</span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-gunmetal border border-edge-steel rounded-lg shadow-xl min-w-[120px] py-1">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                opt.value === value
                  ? "bg-safety-orange/10 text-safety-orange"
                  : "text-concrete hover:text-white hover:bg-edge-steel/40"
              }`}
            >
              <opt.icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

