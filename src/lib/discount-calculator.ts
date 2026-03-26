import type { MoistureRule, DiscountPolicy, DensityPricingRule, PricingUnit } from "@/types/database"

export interface DiscountCalculationInput {
  moisturePercent: number
  finesKg: number
  netWeightKg: number
  grossWeightKg: number
  volumeMdc: number
  priceMdc: number
  densityKgMdc: number | null
}

export interface DiscountBreakdownItem {
  label: string
  weightDeductionKg: number
  volumeDeductionMdc: number
  valueDeduction: number
}

export interface ImpurityDeductionResult {
  deductionKg: number
  finesPercent: number
  withinTolerance: boolean
  tolerancePercent: number
  discountOn: 'gross' | 'net'
}

export interface WeightBreakdown {
  netWeightKg: number
  moistureDeductionKg: number
  finesDeductionKg: number
  adjustedWeightKg: number
  adjustedDensity: number | null
  moistureRule: MoistureRule | null
  impurityResult: ImpurityDeductionResult | null
}

export interface DiscountCalculationResult {
  totalDeduction: number
  breakdown: DiscountBreakdownItem[]
  weightBreakdown: WeightBreakdown
  summary: string
  hasDiscount: boolean
}

/**
 * Encontra a faixa de umidade aplicável
 */
function findMoistureRule(rules: MoistureRule[], moisturePercent: number): MoistureRule | null {
  const sorted = [...rules].sort((a, b) => a.from - b.from)
  for (const rule of sorted) {
    if (moisturePercent >= rule.from && moisturePercent <= rule.to) {
      return rule
    }
  }
  return sorted.length > 0 ? sorted[sorted.length - 1] : null
}

/**
 * Calcula o peso em kg a descontar por umidade no peso líquido.
 *
 * - "none": sem desconto (tolerância)
 * - "excess": desconta excedente acima do início da faixa
 *   Formula: peso_liquido × ((umidade% - faixa.from) / 100)
 * - "total": desconta toda a umidade
 *   Formula: peso_liquido × (umidade% / 100)
 */
export function calculateMoistureWeightDeduction(
  moisturePercent: number,
  netWeightKg: number,
  moistureRules: MoistureRule[]
): { deductionKg: number; rule: MoistureRule | null } {
  if (moisturePercent <= 0 || netWeightKg <= 0 || !moistureRules || moistureRules.length === 0) {
    return { deductionKg: 0, rule: null }
  }

  const rule = findMoistureRule(moistureRules, moisturePercent)
  if (!rule || rule.type === "none") {
    return { deductionKg: 0, rule }
  }

  let deductionPercent = 0

  if (rule.type === "excess") {
    deductionPercent = moisturePercent - rule.from
  } else if (rule.type === "total") {
    deductionPercent = moisturePercent
  }

  if (deductionPercent <= 0) return { deductionKg: 0, rule }

  const deductionKg = Math.round((deductionPercent / 100) * netWeightKg * 100) / 100
  return { deductionKg, rule }
}

/**
 * Calcula a dedução de impurezas considerando tolerância configurável.
 *
 * - tolerancePercent = 0: qualquer impureza é descontada integralmente
 * - tolerancePercent > 0: impurezas até X% do peso de referência são toleradas;
 *   acima de X%, desconta o TOTAL das impurezas em kg
 * - discountOn = "gross": percentual calculado sobre peso bruto
 * - discountOn = "net": percentual calculado sobre peso líquido
 */
export function calculateImpurityDeduction(
  finesKg: number,
  grossWeightKg: number,
  netWeightKg: number,
  tolerancePercent: number,
  discountOn: 'gross' | 'net'
): ImpurityDeductionResult {
  if (finesKg <= 0 || netWeightKg <= 0) {
    return { deductionKg: 0, finesPercent: 0, withinTolerance: true, tolerancePercent, discountOn }
  }

  const referenceWeight = discountOn === 'gross' ? (grossWeightKg || netWeightKg) : netWeightKg
  const finesPercent = Math.round((finesKg / referenceWeight) * 10000) / 100

  if (tolerancePercent > 0 && finesPercent <= tolerancePercent) {
    return { deductionKg: 0, finesPercent, withinTolerance: true, tolerancePercent, discountOn }
  }

  return { deductionKg: finesKg, finesPercent, withinTolerance: false, tolerancePercent, discountOn }
}

/**
 * Calcula a densidade ajustada.
 * Ordem correta da siderúrgica:
 * 1. Peso líquido = bruto - tara
 * 2. Desc. umidade no peso (via regras de umidade)
 * 3. Desc. impurezas no peso
 * 4. Peso ajustado = peso líquido - umidade_kg - impurezas_kg
 * 5. Densidade = peso ajustado / volume_mdc
 */
export function calculateAdjustedDensity(
  netWeightKg: number,
  finesKg: number,
  volumeMdc: number,
  moistureDeductionKg: number = 0
): number | null {
  if (netWeightKg <= 0 || volumeMdc <= 0) return null
  const adjustedWeight = netWeightKg - moistureDeductionKg - (finesKg || 0)
  if (adjustedWeight <= 0) return null
  return Math.round((adjustedWeight / volumeMdc) * 100) / 100
}

/**
 * Busca o preço por MDC na tabela de faixas de densidade.
 * Filtra por person_type quando fornecido e quando as regras possuem person_type.
 * Retrocompatível: regras sem person_type valem para todos.
 * Retorna null se não encontrar faixa aplicável.
 */
export interface PriceMatch {
  price: number
  pricingUnit: PricingUnit
  rule: DensityPricingRule
}

export function findPriceByDensity(
  rules: DensityPricingRule[],
  density: number,
  personType?: 'pf' | 'pj'
): PriceMatch | null {
  if (!rules || rules.length === 0) return null

  const hasPersonTypeRules = rules.some(r => r.person_type)

  // If personType provided and rules have person_type, filter by it
  const applicableRules = personType && hasPersonTypeRules
    ? rules.filter(r => r.person_type === personType)
    : hasPersonTypeRules
      ? rules.filter(r => !r.person_type) // no personType given, use generic rules only
      : rules // no rules have person_type, use all (retrocompat)

  const sorted = [...applicableRules].sort((a, b) => a.min_density - b.min_density)
  for (const rule of sorted) {
    if (density >= rule.min_density && density <= rule.max_density) {
      return { price: rule.price_per_mdc, pricingUnit: rule.pricing_unit || "mdc", rule }
    }
  }

  // Fallback: if personType filter yielded no match, try generic rules
  if (personType && hasPersonTypeRules) {
    const genericRules = rules.filter(r => !r.person_type)
    const sortedGeneric = [...genericRules].sort((a, b) => a.min_density - b.min_density)
    for (const rule of sortedGeneric) {
      if (density >= rule.min_density && density <= rule.max_density) {
        return { price: rule.price_per_mdc, pricingUnit: rule.pricing_unit || "mdc", rule }
      }
    }
  }

  return null
}

/**
 * Calcula o desconto total usando a política configurada.
 *
 * NOVA LÓGICA: Tanto umidade quanto impurezas são descontados NO PESO,
 * não como dedução monetária separada. O impacto é:
 * peso ajustado menor → densidade menor → faixa de preço menor → valor final menor.
 *
 * O campo `deductions` fica reservado para outros descontos manuais ou FUNRURAL.
 */
export function calculateDiscount(
  policy: DiscountPolicy,
  input: DiscountCalculationInput
): DiscountCalculationResult {
  const breakdown: DiscountBreakdownItem[] = []

  // Calcular desconto de umidade no peso
  const { deductionKg: moistureKg, rule: moistureRule } = calculateMoistureWeightDeduction(
    input.moisturePercent,
    input.netWeightKg,
    policy.moisture_rules
  )

  // Calcular desconto de impurezas com tolerância
  const impurityResult = calculateImpurityDeduction(
    input.finesKg || 0,
    input.grossWeightKg,
    input.netWeightKg,
    policy.impurity_tolerance_percent ?? 0,
    policy.impurity_discount_on ?? "net"
  )

  // Peso ajustado = líquido - umidade - impurezas (com tolerância)
  const adjustedWeight = input.netWeightKg - moistureKg - impurityResult.deductionKg
  const adjustedDensity = adjustedWeight > 0 && input.volumeMdc > 0
    ? Math.round((adjustedWeight / input.volumeMdc) * 100) / 100
    : null

  // Info de umidade no breakdown (para exibição — valor monetário = 0)
  if (moistureKg > 0) {
    const typeLabel = moistureRule?.type === "excess"
      ? `excedente ${(input.moisturePercent - (moistureRule?.from || 0)).toFixed(1)}%`
      : `total ${input.moisturePercent.toFixed(1)}%`

    breakdown.push({
      label: `Umidade ${input.moisturePercent}% (${typeLabel}): -${moistureKg.toFixed(0)} kg no peso`,
      weightDeductionKg: moistureKg,
      volumeDeductionMdc: 0,
      valueDeduction: 0,
    })
  }

  // Info de impurezas no breakdown
  if (input.finesKg > 0) {
    if (impurityResult.withinTolerance) {
      breakdown.push({
        label: `Impurezas: 0 kg (${impurityResult.finesPercent.toFixed(1)}% — dentro da tolerância de ${impurityResult.tolerancePercent}%)`,
        weightDeductionKg: 0,
        volumeDeductionMdc: 0,
        valueDeduction: 0,
      })
    } else {
      const tolLabel = impurityResult.tolerancePercent > 0
        ? ` (${impurityResult.finesPercent.toFixed(1)}% — acima da tolerância de ${impurityResult.tolerancePercent}%)`
        : ""
      breakdown.push({
        label: `Impurezas: -${input.finesKg.toFixed(0)} kg no peso${tolLabel}`,
        weightDeductionKg: input.finesKg,
        volumeDeductionMdc: 0,
        valueDeduction: 0,
      })
    }
  }

  const weightBreakdown: WeightBreakdown = {
    netWeightKg: input.netWeightKg,
    moistureDeductionKg: moistureKg,
    finesDeductionKg: impurityResult.deductionKg,
    adjustedWeightKg: Math.max(adjustedWeight, 0),
    adjustedDensity,
    moistureRule,
    impurityResult,
  }

  const totalDeduction = 0 // Descontos no peso, não monetários

  const parts: string[] = []
  if (moistureKg > 0) parts.push(`Umidade -${moistureKg.toFixed(0)}kg`)
  if (impurityResult.deductionKg > 0) parts.push(`Impurezas -${impurityResult.deductionKg.toFixed(0)}kg`)
  else if (input.finesKg > 0 && impurityResult.withinTolerance) parts.push(`Impurezas 0kg (tolerância)`)
  const summary = parts.length > 0
    ? `Descontados no peso: ${parts.join(", ")}`
    : "Sem descontos no peso"

  return {
    totalDeduction,
    breakdown,
    weightBreakdown,
    summary,
    hasDiscount: moistureKg > 0 || impurityResult.deductionKg > 0,
  }
}

/**
 * Política padrão (fallback quando não há política configurada)
 */
export const DEFAULT_POLICY: DiscountPolicy = {
  id: "default",
  organization_id: "",
  name: "Padrão do sistema",
  is_active: true,
  moisture_rules: [
    { from: 0, to: 5.99, type: "none" },
    { from: 6, to: 10, type: "excess" },
    { from: 10.01, to: 100, type: "total" },
  ],
  impurity_tolerance_percent: 0,
  impurity_discount_on: "net",
  density_pricing_rules: [],
  effective_date: undefined,
  source_document_url: undefined,
  additional_rules: undefined,
  created_by: null,
  created_at: "",
  updated_at: "",
}
