"use client";

import type { ExpenseType } from "@/lib/ii-types";
import { Wrench, HardHat, Building } from "lucide-react";

interface ExpenseTypeSelectorProps {
  value: ExpenseType;
  onChange: (value: ExpenseType) => void;
  disabled?: boolean;
}

const OPTIONS: {
  value: ExpenseType;
  label: string;
  icon: typeof Wrench;
  activeClass: string;
}[] = [
  {
    value: "material",
    label: "Mat",
    icon: Wrench,
    activeClass: "bg-safety-orange/20 text-safety-orange border-safety-orange/40",
  },
  {
    value: "labour",
    label: "Lab",
    icon: HardHat,
    activeClass: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  },
  {
    value: "overhead",
    label: "OH",
    icon: Building,
    activeClass: "bg-concrete/20 text-concrete border-concrete/40",
  },
];

export default function ExpenseTypeSelector({
  value,
  onChange,
  disabled,
}: ExpenseTypeSelectorProps) {
  return (
    <div className="flex gap-0.5">
      {OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            title={opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}
            className={`
              flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border transition-colors
              ${
                isActive
                  ? opt.activeClass
                  : "border-transparent text-concrete/40 hover:text-concrete hover:bg-edge-steel/30"
              }
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
          >
            <opt.icon className="w-3 h-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

