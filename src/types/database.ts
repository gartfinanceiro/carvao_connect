export type CharcoalType = 'eucalipto' | 'tipi' | 'babassu' | 'nativo' | 'misto'
export type DocStatus = 'regular' | 'pendente' | 'irregular'
export type SupplierStatus = 'ativo' | 'inativo' | 'bloqueado' | 'arquivado'
export type ContactType = 'ligou' | 'recebeu_ligacao' | 'whatsapp' | 'presencial'
export type ContactResult = 'atendeu' | 'nao_atendeu' | 'caixa_postal' | 'ocupado'
export type NextStepType = 'retornar_em' | 'aguardar_retorno' | 'nenhum'
export type AlertType = 'follow_up' | 'retorno_automatico' | 'vencimento_doc' | 'confirmacao_carga' | 'inatividade'
export type AlertStatus = 'pendente' | 'concluido' | 'descartado' | 'adiado'
export type AlertPriority = 'alta' | 'media' | 'baixa'

export type SupplierDocumentType =
  | 'dcf'
  | 'taxa_florestal'
  | 'documentos_pessoais'
  | 'conta_deposito'
  | 'mapa_area'
  | 'certidao_imovel'
  | 'contrato_arrendamento'
  | 'inventario_area'
  | 'cadastro_tecnico_federal'
  | 'inscricao_estadual'
  | 'shapefile'
  | 'outro'

export type PlanType = 'trial' | 'starter' | 'professional' | 'enterprise' | 'canceled'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'
export type UserRole = 'admin' | 'member'

export interface PlanLimits {
  max_suppliers: number
  max_users: number
  whatsapp_enabled: boolean
}

export interface Organization {
  id: string
  name: string
  document: string | null
  address: string | null
  city: string | null
  state: string | null
  phone: string | null
  state_registration: string | null
  plan: PlanType
  plan_limits: PlanLimits
  trial_ends_at: string | null
  subscription_status: SubscriptionStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
  created_by: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string
  name: string
  role: UserRole
  created_at: string
  updated_at: string
}

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface Invite {
  id: string
  organization_id: string
  email: string
  role: UserRole
  invited_by: string
  token: string
  status: InviteStatus
  expires_at: string
  created_at: string
  accepted_at: string | null
}

export type PersonType = 'pf' | 'pj'

export interface Supplier {
  id: string
  organization_id: string
  name: string
  document: string | null
  phones: string[]
  city: string | null
  state: string | null
  contact_name: string | null
  person_type: PersonType
  avg_density: number | null
  monthly_capacity: number | null
  contracted_loads: number
  doc_status: DocStatus
  dcf_issue_date: string | null
  dcf_expiry: string | null
  dcf_number: string | null
  last_price: number | null
  bank_name: string | null
  bank_agency: string | null
  bank_account: string | null
  notes: string | null
  status: SupplierStatus
  last_contact_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PromisedStatus = 'pendente' | 'agendada' | 'entregue' | 'cancelada' | 'adiada'

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
  promised_status: PromisedStatus
  promised_cancel_reason: string | null
  resolved_discharge_id: string | null
  resolved_queue_id: string | null
  created_at: string
  updated_at: string
}

export interface SupplierDocument {
  id: string
  supplier_id: string
  organization_id: string
  document_type: SupplierDocumentType
  original_filename: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  uploaded_by: string | null
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

// WhatsApp types
export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'banned' | 'rate_limited'
export type WhatsAppMessageDirection = 'inbound' | 'outbound'
export type WhatsAppMessageType = 'text' | 'audio' | 'image' | 'document' | 'location' | 'contact' | 'sticker' | 'other'
export type WhatsAppConversationStatus = 'open' | 'ready_for_processing' | 'processing' | 'processed' | 'error' | 'skipped'
export type AiSuggestionStatus = 'pending' | 'accepted' | 'edited' | 'dismissed'

export type WhatsAppQualityRating = 'GREEN' | 'YELLOW' | 'RED'
export type WhatsAppMessageStatus = 'received' | 'sent' | 'delivered' | 'read' | 'failed'
export type WhatsAppTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
export type WhatsAppTemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED'

export interface WhatsAppConnection {
  id: string
  organization_id: string
  meta_waba_id: string | null
  meta_phone_number_id: string | null
  meta_access_token: string | null
  meta_token_expires_at: string | null
  display_phone_number: string | null
  verified_name: string | null
  quality_rating: WhatsAppQualityRating
  messaging_limit: string | null
  label: string
  webhook_verified: boolean
  status: WhatsAppConnectionStatus
  connected_phone: string | null
  connected_at: string | null
  disconnected_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WhatsAppMessage {
  id: string
  organization_id: string
  conversation_id: string | null
  connection_id: string | null
  meta_message_id: string | null
  phone: string
  supplier_id: string | null
  direction: WhatsAppMessageDirection
  message_type: WhatsAppMessageType
  content: string | null
  media_url: string | null
  media_mime_type: string | null
  file_name: string | null
  sender_name: string | null
  sender_photo_url: string | null
  is_group: boolean
  status: WhatsAppMessageStatus
  error_code: string | null
  error_message: string | null
  context_message_id: string | null
  raw_payload: Record<string, unknown> | null
  message_timestamp: string
  created_at: string
}

export interface WhatsAppTemplate {
  id: string
  organization_id: string
  connection_id: string | null
  meta_template_id: string | null
  name: string
  language: string
  category: WhatsAppTemplateCategory
  status: WhatsAppTemplateStatus
  components: Record<string, unknown>[]
  created_at: string
  updated_at: string
}

export interface WhatsAppConversation {
  id: string
  organization_id: string
  connection_id: string | null
  supplier_id: string | null
  phone: string
  started_at: string
  last_message_at: string
  message_count: number
  inactivity_minutes: number
  status: WhatsAppConversationStatus
  transcript: string | null
  processed_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface AiSuggestion {
  id: string
  organization_id: string
  conversation_id: string
  supplier_id: string | null
  extracted_data: Record<string, unknown>
  confidence: number
  contact_result: string | null
  load_promised: boolean | null
  promised_volume: number | null
  promised_date: string | null
  price_per_mdc: number | null
  next_step: string | null
  next_step_date: string | null
  summary: string | null
  status: AiSuggestionStatus
  accepted_by: string | null
  accepted_at: string | null
  dismissed_reason: string | null
  interaction_id: string | null
  created_at: string
  updated_at: string
}

export interface ExtractionResult {
  resumo: string
  resultado_contato: 'atendeu' | 'nao_atendeu'
  tipo_carvao: string | null
  preco_por_mdc: number | null
  carga_prometida: boolean
  volume_prometido: number | null
  data_prometida: string | null
  densidade_mencionada: number | null
  disponibilidade_imediata: boolean | null
  proximo_passo: 'retornar_em' | 'aguardar_retorno' | 'nenhum'
  proximo_passo_data: string | null
  proximo_passo_descricao: string | null
  confianca: number
}

export interface Discharge {
  id: string
  organization_id: string
  supplier_id: string
  interaction_id: string | null
  discharge_date: string
  volume_mdc: number
  gross_weight_kg: number | null
  tare_weight_kg: number | null
  net_weight_kg: number | null
  density_kg_mdc: number | null
  moisture_percent: number
  fines_kg: number
  fines_percent: number
  price_per_mdc: number
  gross_total: number | null
  deductions: number
  net_total: number | null
  truck_plate: string | null
  invoice_number: string | null
  forest_guide: string | null
  charcoal_type: CharcoalType | null
  gca_emitida: boolean
  funrural_percent: number
  funrural_value: number
  discharge_number: number | null
  pricing_unit: PricingUnit
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  supplier?: { name: string }
}


// Discount Policy types
export type MoistureDiscountType = 'none' | 'excess' | 'total'
export type ImpurityDiscountOn = 'gross' | 'net'

export interface MoistureRule {
  from: number
  to: number
  type: MoistureDiscountType
}

export type PricingUnit = 'mdc' | 'ton'

export interface DensityPricingRule {
  person_type?: 'pf' | 'pj'
  min_density: number
  max_density: number
  price_per_mdc: number
  pricing_unit?: PricingUnit
}

export interface PricingAdditionalRules {
  metering_tolerance_percent?: number
  payment_method?: string
  payment_deadline?: string
  species_required?: string
  third_party_payment_rule?: string
  notes?: string
}

export interface DiscountPolicy {
  id: string
  organization_id: string
  name: string
  is_active: boolean
  moisture_rules: MoistureRule[]
  impurity_tolerance_percent: number
  impurity_discount_on: ImpurityDiscountOn
  density_pricing_rules: DensityPricingRule[]
  effective_date?: string
  source_document_url?: string
  additional_rules?: PricingAdditionalRules
  created_by: string | null
  created_at: string
  updated_at: string
}

export type QueueEntryType = 'fila' | 'agendamento'
export type QueueStatus = 'aguardando' | 'em_descarga' | 'concluido' | 'cancelado'

export interface QueueEntry {
  id: string
  organization_id: string
  supplier_id: string
  discharge_id: string | null
  entry_type: QueueEntryType
  truck_plate: string | null
  driver_name: string | null
  estimated_volume_mdc: number | null
  scheduled_date: string
  scheduled_time: string | null
  scheduled_position: number | null
  arrival_time: string | null
  queue_position: number | null
  status: QueueStatus
  gca_emitida: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  suppliers?: { name: string; avg_density: number | null; last_price: number | null }
}
