export type SupplierClassification = 'estrategico' | 'oportunidade' | 'dependencia' | 'complementar'

export interface ClassificationResult {
  key: SupplierClassification
  label: string
  description: string
  actionHint: string
  color: string
}

export interface SupplierMetrics {
  utilization: number    // aproveitamento: contracted / capacity (0-100)
  share: number          // participação: contracted / total_all (0-100, 1 decimal)
  idleCapacity: number   // cargas ociosas
}

const THRESHOLDS = {
  HIGH_CAPACITY: 8,
  HIGH_SHARE: 15,
}

export function getSupplierMetrics(
  monthlyCapacity: number | null | undefined,
  contractedLoads: number,
  totalContractedAll: number,
): SupplierMetrics {
  const cap = monthlyCapacity ?? 0
  return {
    utilization: cap > 0 ? Math.round((contractedLoads / cap) * 100) : 0,
    share: totalContractedAll > 0
      ? Math.round((contractedLoads / totalContractedAll) * 100 * 10) / 10
      : 0,
    idleCapacity: Math.max(0, cap - contractedLoads),
  }
}

export function classifySupplier(
  monthlyCapacity: number | null | undefined,
  contractedLoads: number,
  totalContractedAll: number,
): ClassificationResult {
  const cap = monthlyCapacity ?? 0

  if (cap <= 0) {
    return {
      key: 'complementar',
      label: 'Não classificado',
      description: 'Capacidade mensal não informada',
      actionHint: 'Preencha a capacidade mensal no cadastro',
      color: 'text-muted-foreground',
    }
  }

  const metrics = getSupplierMetrics(monthlyCapacity, contractedLoads, totalContractedAll)
  const highCap = cap >= THRESHOLDS.HIGH_CAPACITY
  const highShare = metrics.share >= THRESHOLDS.HIGH_SHARE

  if (highCap && highShare) {
    return {
      key: 'estrategico',
      label: 'Estratégico',
      description: `Grande porte (${cap} cargas/mês), ${metrics.share}% do consumo`,
      actionHint: 'Parceiro-chave. Manter relacionamento próximo e negociar condições de longo prazo.',
      color: 'text-blue-600',
    }
  }

  if (highCap && !highShare) {
    return {
      key: 'oportunidade',
      label: 'Oportunidade',
      description: `Grande porte (${cap} cargas/mês), apenas ${metrics.share}% do consumo`,
      actionHint: 'Capacidade ociosa disponível. Avaliar aumento de volume com melhor preço.',
      color: 'text-amber-600',
    }
  }

  if (!highCap && highShare) {
    return {
      key: 'dependencia',
      label: 'Dependência',
      description: `Pequeno porte (${cap} cargas/mês) mas ${metrics.share}% do consumo`,
      actionHint: 'Risco: fornecedor pequeno com participação alta. Diversificar volume.',
      color: 'text-orange-600',
    }
  }

  return {
    key: 'complementar',
    label: 'Complementar',
    description: `Pequeno porte (${cap} cargas/mês), ${metrics.share}% do consumo`,
    actionHint: 'Apoio pontual para picos de demanda. Manter cadastro atualizado.',
    color: 'text-muted-foreground',
  }
}

export const classificationFilterOptions = [
  { value: 'all', label: 'Todos os portes' },
  { value: 'estrategico', label: 'Estratégico' },
  { value: 'oportunidade', label: 'Oportunidade' },
  { value: 'dependencia', label: 'Dependência' },
  { value: 'complementar', label: 'Complementar' },
] as const

export const classificationSortOrder: Record<SupplierClassification, number> = {
  dependencia: 1,
  estrategico: 2,
  oportunidade: 3,
  complementar: 4,
}
