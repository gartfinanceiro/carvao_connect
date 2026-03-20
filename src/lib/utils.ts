import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return "Nunca"
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Hoje"
  if (diffDays === 1) return "Ontem"
  if (diffDays < 7) return `há ${diffDays} dias`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `há ${weeks} semana${weeks > 1 ? "s" : ""}`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `há ${months} ${months > 1 ? "meses" : "mês"}`
  }
  const years = Math.floor(diffDays / 365)
  return `há ${years} ano${years > 1 ? "s" : ""}`
}

export function getDaysFromNow(dateString: string | null): number | null {
  if (!dateString) return null
  const date = new Date(dateString)
  const now = new Date()
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return phone
}

export function formatDocument(doc: string | null): string {
  if (!doc) return "—"
  const digits = doc.replace(/\D/g, "")
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
  }
  return doc
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "Não informado"
  const [year, month, day] = dateString.split("-")
  if (!year || !month || !day) return dateString
  return `${day}/${month}/${year}`
}

export function validateDocument(doc: string): boolean {
  const digits = doc.replace(/\D/g, "")
  return digits.length === 11 || digits.length === 14
}

export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "")
  return digits.length >= 10
}

export type VolumeUnit = "mdc" | "ton"

export function convertVolume(
  volumeMdc: number,
  densityKgMdc: number | null,
  unit: VolumeUnit,
): number {
  if (unit === "mdc" || !densityKgMdc || densityKgMdc <= 0) return volumeMdc
  return Math.round((volumeMdc * densityKgMdc) / 1000 * 10) / 10
}

export function convertPrice(
  pricePerMdc: number | null,
  densityKgMdc: number | null,
  unit: VolumeUnit,
): number | null {
  if (pricePerMdc === null || pricePerMdc === undefined) return null
  if (unit === "mdc" || !densityKgMdc || densityKgMdc <= 0) return pricePerMdc
  return Math.round((pricePerMdc * 1000) / densityKgMdc * 100) / 100
}

export function formatVolume(
  volumeMdc: number,
  densityKgMdc: number | null,
  unit: VolumeUnit,
): string {
  const value = convertVolume(volumeMdc, densityKgMdc, unit)
  return `${value.toLocaleString("pt-BR")} ${unit === "mdc" ? "MDC" : "ton"}`
}

export function unitLabel(unit: VolumeUnit): string {
  return unit === "mdc" ? "MDC" : "ton"
}

export function priceUnitLabel(unit: VolumeUnit): string {
  return unit === "mdc" ? "/mdc" : "/ton"
}
