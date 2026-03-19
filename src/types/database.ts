export type CharcoalType = 'eucalipto' | 'tipi' | 'babassu' | 'nativo' | 'misto'
export type DocStatus = 'regular' | 'pendente' | 'irregular'
export type SupplierStatus = 'ativo' | 'inativo' | 'bloqueado'
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
  dcf_issue_date: string | null
  dcf_expiry: string | null
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
export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'connected'
export type WhatsAppMessageDirection = 'inbound' | 'outbound'
export type WhatsAppMessageType = 'text' | 'audio' | 'image' | 'document' | 'location' | 'contact' | 'sticker' | 'other'
export type WhatsAppConversationStatus = 'open' | 'ready_for_processing' | 'processing' | 'processed' | 'error' | 'skipped'
export type AiSuggestionStatus = 'pending' | 'accepted' | 'edited' | 'dismissed'

export interface WhatsAppConnection {
  id: string
  organization_id: string
  instance_id: string
  instance_token: string
  client_token: string
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
  zapi_message_id: string | null
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
  raw_payload: Record<string, unknown> | null
  message_timestamp: string
  created_at: string
}

export interface WhatsAppConversation {
  id: string
  organization_id: string
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
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  supplier?: { name: string; charcoal_type: CharcoalType }
}
