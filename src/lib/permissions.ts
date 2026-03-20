// ============================================================
// Módulos do sistema
// ============================================================

export const MODULES = [
  'fornecedores',
  'descargas',
  'financeiro',
  'relatorios',
  'whatsapp',
  'configuracoes',
  'feed',
  'fila',
] as const

export type ModuleKey = (typeof MODULES)[number]

export type Permissions = Record<ModuleKey, boolean>

// ============================================================
// Templates pré-definidos
// ============================================================

export type ProfileTemplate = 'compras' | 'financeiro' | 'completo' | 'custom'

export const PROFILE_TEMPLATES: Record<
  Exclude<ProfileTemplate, 'custom'>,
  {
    label: string
    description: string
    permissions: Permissions
  }
> = {
  compras: {
    label: 'Compras',
    description:
      'Fornecedores, descargas, fila e alertas. Sem acesso a financeiro nem configurações.',
    permissions: {
      fornecedores: true,
      descargas: true,
      financeiro: false,
      relatorios: false,
      whatsapp: true,
      configuracoes: false,
      feed: true,
      fila: true,
    },
  },
  financeiro: {
    label: 'Financeiro',
    description:
      'Descargas com valores, relatórios e fornecedores. Sem fila nem alertas.',
    permissions: {
      fornecedores: true,
      descargas: true,
      financeiro: true,
      relatorios: true,
      whatsapp: false,
      configuracoes: false,
      feed: false,
      fila: false,
    },
  },
  completo: {
    label: 'Completo',
    description: 'Acesso total exceto configurações de billing e equipe.',
    permissions: {
      fornecedores: true,
      descargas: true,
      financeiro: true,
      relatorios: true,
      whatsapp: true,
      configuracoes: false,
      feed: true,
      fila: true,
    },
  },
}

// ============================================================
// Labels dos módulos (para exibição na UI)
// ============================================================

export const MODULE_LABELS: Record<
  ModuleKey,
  { label: string; description: string }
> = {
  fornecedores: {
    label: 'Fornecedores',
    description: 'Cadastro, edição, timeline de interações',
  },
  descargas: {
    label: 'Descargas',
    description: 'Registro e visualização de descargas',
  },
  financeiro: {
    label: 'Financeiro',
    description: 'Valores, preços, descontos em todas as telas',
  },
  relatorios: {
    label: 'Relatórios',
    description: 'Gerar relatórios PDF de descargas',
  },
  whatsapp: {
    label: 'WhatsApp',
    description: 'Conexão, sugestões de IA, captura de mensagens',
  },
  configuracoes: {
    label: 'Configurações',
    description: 'Billing, equipe, convites, dados da org',
  },
  feed: {
    label: 'Feed / Alertas',
    description: 'Tela inicial com alertas e ações do dia',
  },
  fila: {
    label: 'Fila de descargas',
    description: 'Gerenciar fila de chegada de cargas',
  },
}

// ============================================================
// Funções de checagem
// ============================================================

/**
 * Verifica se o usuário tem acesso a um módulo.
 * Admin (permissions = null) SEMPRE retorna true.
 * Member sem permissions definidas SEMPRE retorna true (fallback seguro).
 */
export function hasModuleAccess(
  permissions: Permissions | null | undefined,
  module: ModuleKey
): boolean {
  if (!permissions) return true
  return permissions[module] !== false
}

/**
 * Verifica se o módulo "financeiro" está liberado.
 */
export function canSeeFinancials(
  permissions: Permissions | null | undefined
): boolean {
  return hasModuleAccess(permissions, 'financeiro')
}

/**
 * Retorna a primeira rota acessível para redirect.
 */
export function getDefaultRoute(
  permissions: Permissions | null | undefined
): string {
  if (!permissions) return '/dashboard'
  if (permissions.feed) return '/dashboard'
  if (permissions.fornecedores) return '/fornecedores'
  if (permissions.descargas) return '/descargas'
  if (permissions.fila) return '/fila'
  if (permissions.configuracoes) return '/configuracoes'
  return '/dashboard'
}

/**
 * Mapa módulo → rota (para sidebar e redirect)
 */
export const MODULE_ROUTES: Record<ModuleKey, string | null> = {
  feed: '/dashboard',
  fornecedores: '/fornecedores',
  descargas: '/descargas',
  fila: '/fila',
  configuracoes: '/configuracoes',
  financeiro: null,
  relatorios: null,
  whatsapp: null,
}

/**
 * Conta quantos módulos estão habilitados.
 */
export function countEnabledModules(
  permissions: Permissions | null | undefined
): number {
  if (!permissions) return MODULES.length
  return MODULES.filter((m) => permissions[m]).length
}
