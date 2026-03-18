"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { charcoalTypeLabels, docStatusLabels, supplierStatusLabels, UF_OPTIONS } from "@/lib/labels"
import type { CharcoalType, DocStatus, SupplierStatus } from "@/types/database"

interface SupplierFiltersProps {
  charcoalType: string
  docStatus: string
  status: string
  uf: string
  onCharcoalTypeChange: (value: string) => void
  onDocStatusChange: (value: string) => void
  onStatusChange: (value: string) => void
  onUfChange: (value: string) => void
}

export function SupplierFilters({
  charcoalType,
  docStatus,
  status,
  uf,
  onCharcoalTypeChange,
  onDocStatusChange,
  onStatusChange,
  onUfChange,
}: SupplierFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select value={charcoalType} onValueChange={(v) => onCharcoalTypeChange(v ?? "all")}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Tipo de carvão" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          {(Object.entries(charcoalTypeLabels) as [CharcoalType, string][]).map(
            ([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            )
          )}
        </SelectContent>
      </Select>

      <Select value={docStatus} onValueChange={(v) => onDocStatusChange(v ?? "all")}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status docs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os docs</SelectItem>
          {(Object.entries(docStatusLabels) as [DocStatus, string][]).map(
            ([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            )
          )}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(v) => onStatusChange(v ?? "all")}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {(Object.entries(supplierStatusLabels) as [SupplierStatus, string][]).map(
            ([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            )
          )}
        </SelectContent>
      </Select>

      <Select value={uf} onValueChange={(v) => onUfChange(v ?? "all")}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="UF" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas UFs</SelectItem>
          {UF_OPTIONS.map((ufOption) => (
            <SelectItem key={ufOption} value={ufOption}>
              {ufOption}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
