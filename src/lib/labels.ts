import type {
  CharcoalType,
  DocStatus,
  SupplierStatus,
  ContactType,
  ContactResult,
  NextStepType,
  AlertType,
  AlertStatus,
  AlertPriority,
} from "@/types/database"

export const charcoalTypeLabels: Record<CharcoalType, string> = {
  eucalipto: "Eucalipto",
  tipi: "Tipi",
  babassu: "Babaçu",
  nativo: "Nativo",
  misto: "Misto",
}

export const docStatusLabels: Record<DocStatus, string> = {
  regular: "Regular",
  pendente: "Pendente",
  irregular: "Irregular",
}

export const supplierStatusLabels: Record<SupplierStatus, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  bloqueado: "Bloqueado",
}

export const contactTypeLabels: Record<ContactType, string> = {
  ligou: "Ligou",
  recebeu_ligacao: "Recebeu ligação",
  whatsapp: "WhatsApp",
  presencial: "Presencial",
}

export const contactTypeIcons: Record<ContactType, string> = {
  ligou: "\u{1F4DE}",
  recebeu_ligacao: "\u{1F4F2}",
  whatsapp: "\u{1F4AC}",
  presencial: "\u{1F91D}",
}

export const contactResultLabels: Record<ContactResult, string> = {
  atendeu: "Atendeu",
  nao_atendeu: "Não atendeu",
  caixa_postal: "Caixa postal",
  ocupado: "Ocupado",
}

export const contactResultColors: Record<ContactResult, string> = {
  atendeu: "bg-green-100 text-green-800",
  nao_atendeu: "bg-yellow-100 text-yellow-800",
  caixa_postal: "bg-gray-100 text-gray-800",
  ocupado: "bg-gray-100 text-gray-800",
}

export const nextStepTypeLabels: Record<NextStepType, string> = {
  retornar_em: "Retornar em",
  aguardar_retorno: "Aguardar retorno",
  nenhum: "Nenhum",
}

export const alertTypeLabels: Record<AlertType, string> = {
  follow_up: "Follow-up",
  retorno_automatico: "Retorno automático",
  vencimento_doc: "Vencimento de documento",
  confirmacao_carga: "Confirmação de carga",
  inatividade: "Inatividade",
}

export const alertTypeIcons: Record<AlertType, string> = {
  follow_up: "\u{1F4DE}",
  retorno_automatico: "\u{1F4DE}",
  vencimento_doc: "\u{1F4C4}",
  confirmacao_carga: "\u{1F4E6}",
  inatividade: "\u{1F464}",
}

export const alertStatusLabels: Record<AlertStatus, string> = {
  pendente: "Pendente",
  concluido: "Concluído",
  descartado: "Descartado",
  adiado: "Adiado",
}

export const alertPriorityLabels: Record<AlertPriority, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
}

export const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const
