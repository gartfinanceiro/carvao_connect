export type CharcoalType = 'eucalipto' | 'tipi' | 'babassu' | 'nativo' | 'misto'
export type DocStatus = 'regular' | 'pendente' | 'irregular'
export type SupplierStatus = 'ativo' | 'inativo' | 'bloqueado'
export type ContactType = 'ligou' | 'recebeu_ligacao' | 'whatsapp' | 'presencial'
export type ContactResult = 'atendeu' | 'nao_atendeu' | 'caixa_postal' | 'ocupado'
export type NextStepType = 'retornar_em' | 'aguardar_retorno' | 'nenhum'
export type AlertType = 'follow_up' | 'retorno_automatico' | 'vencimento_doc' | 'confirmacao_carga' | 'inatividade'
export type AlertStatus = 'pendente' | 'concluido' | 'descartado' | 'adiado'
export type AlertPriority = 'alta' | 'media' | 'baixa'

export interface Organization {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  organization_id: string
  name: string
  document: string | null
  phones: string[]
  city: string | null
  state: string | null
  charcoal_type: CharcoalType
  avg_density: number | null
  monthly_capacity: number | null
  contracted_loads: number
  doc_status: DocStatus
  dap_expiry: string | null
  gf_expiry: string | null
  last_price: number | null
  notes: string | null
  status: SupplierStatus
  last_contact_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Interaction {
  id: string
  supplier_id: string
  organization_id: string
  user_id: string
  contact_type: ContactType
  result: ContactResult
  notes: string | null
  next_step: NextStepType
  next_step_date: string | null
  load_promised: boolean
  promised_volume: number | null
  promised_date: string | null
  created_at: string
  updated_at: string
}

export interface Alert {
  id: string
  organization_id: string
  supplier_id: string
  interaction_id: string | null
  type: AlertType
  title: string
  description: string | null
  due_at: string
  status: AlertStatus
  dismissed_reason: string | null
  snoozed_until: string | null
  priority: AlertPriority
  created_at: string
  updated_at: string
}
