"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { docStatusLabels, supplierStatusLabels, personTypeLabels, UF_OPTIONS } from "@/lib/labels"
import type { DocStatus, PersonType, SupplierStatus } from "@/types/database"

interface SupplierFiltersProps {
  personType: string
  docStatus: string
  status: string
  uf: string
  onPersonTypeChange: (value: string) => void
  onDocStatusChange: (value: string) => void
  onStatusChange: (value: string) => void
  onUfChange: (value: string) => void
}

export function SupplierFilters({
  personType,
  docStatus,
  status,
  uf,
  onPersonTypeChange,
  onDocStatusChange,
  onStatusChange,
  onUfChange,
}: SupplierFiltersProps) {
  const personTypeValueLabel: Record<string, string> = {
    all: "PF / PJ",
    ...personTypeLabels,
  }
  const docStatusValueLabel: Record<string, string> = {
    all: "Todos os docs",
    ...docStatusLabels,
  }
  const statusValueLabel: Record<string, string> = {
    all: "Todos",
    ...supplierStatusLabels,
  }
  const ufValueLabel: Record<string, string> = {
    all: "Todas UFs",
    ...Object.fromEntries(UF_OPTIONS.map((u) => [u, u])),
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={personType} onValueChange={(v) => onPersonTypeChange(v ?? "all")}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="PF / PJ">
            {(value: string) => personTypeValueLabel[value] ?? value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">PF / PJ</SelectItem>
          {(Object.entries(personTypeLabels) as [PersonType, string][]).map(
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
          <SelectValue placeholder="Status docs">
            {(value: string) => docStatusValueLabel[value] ?? value}
          </SelectValue>
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
          <SelectValue placeholder="Status">
            {(value: string) => statusValueLabel[value] ?? value}
          </SelectValue>
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
          <SelectValue placeholder="UF">
            {(value: string) => ufValueLabel[value] ?? value}
          </SelectValue>
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
