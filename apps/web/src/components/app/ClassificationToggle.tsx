"use client";

import type { Classification } from "@/lib/ii-types";
import { Briefcase, ShoppingBag, HelpCircle } from "lucide-react";

interface ClassificationToggleProps {
  value: Classification;
  onChange: (value: Classification) => void;
  disabled?: boolean;
}

const OPTIONS: {
  value: Classification;
  label: string;
  icon: typeof Briefcase;
  activeClass: string;
}[] = [
  {
    value: "business",
    label: "Biz",
    icon: Briefcase,
    activeClass: "bg-safe/20 text-safe border-safe/40",
  },
  {
    value: "personal",
    label: "Per",
    icon: ShoppingBag,
    activeClass: "bg-concrete/20 text-concrete border-concrete/40",
  },
  {
    value: "unclassified",
    label: "",
    icon: HelpCircle,
    activeClass: "bg-warn/20 text-warn border-warn/40",
  },
];

export default function ClassificationToggle({
  value,
  onChange,
  disabled,
}: ClassificationToggleProps) {
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
