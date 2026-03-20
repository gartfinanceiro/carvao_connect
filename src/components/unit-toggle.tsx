"use client"

import type { VolumeUnit } from "@/lib/utils"

interface UnitToggleProps {
  unit: VolumeUnit
  onChange: (unit: VolumeUnit) => void
}

export function UnitToggle({ unit, onChange }: UnitToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border/50 bg-white overflow-hidden text-xs font-medium">
      <button
        onClick={() => onChange("mdc")}
        className={`px-2.5 py-1 transition-colors ${
          unit === "mdc"
            ? "bg-[#1B4332] text-white"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        MDC
      </button>
      <button
        onClick={() => onChange("ton")}
        className={`px-2.5 py-1 transition-colors ${
          unit === "ton"
            ? "bg-[#1B4332] text-white"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Tonelada
      </button>
    </div>
  )
}
