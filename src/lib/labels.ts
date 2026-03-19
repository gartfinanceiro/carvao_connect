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
  SupplierDocumentType,
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
  atendeu: "bg-emerald-50 text-emerald-600",
  nao_atendeu: "bg-amber-50 text-amber-600",
  caixa_postal: "bg-gray-100 text-gray-600",
  ocupado: "bg-gray-100 text-gray-600",
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

export const supplierDocumentTypeLabels: Record<SupplierDocumentType, string> = {
  dcf: "DCF (Declaração de Colheita)",
  taxa_florestal: "Taxa Florestal e Expediente",
  documentos_pessoais: "Documentos Pessoais (RG/CPF)",
  conta_deposito: "Conta para Depósito / Procuração",
  mapa_area: "Mapa da Área (DCF)",
  certidao_imovel: "Certidão de Registro do Imóvel",
  contrato_arrendamento: "Contrato de Arrendamento",
  inventario_area: "Inventário da Área (>50 ha)",
  cadastro_tecnico_federal: "Cadastro Técnico Federal",
  inscricao_estadual: "Inscrição Estadual do Imóvel",
  shapefile: "Shapefile",
  outro: "Outro Documento",
}

export const supplierDocumentTypeDescriptions: Record<SupplierDocumentType, string> = {
  dcf: "Cópia da declaração de colheita de florestas plantadas e produção de carvão",
  taxa_florestal: "Cópia da taxa florestal e expediente referente à DCF",
  documentos_pessoais: "Cópia do RG e CPF do produtor",
  conta_deposito: "Conta para depósito em nome do produtor. Se procurador, incluir procuração",
  mapa_area: "Mapa da área descrita na DCF para exploração",
  certidao_imovel: "Cópia da certidão de registro do imóvel",
  contrato_arrendamento: "Contrato de arrendamento com proprietário (se imóvel arrendado)",
  inventario_area: "Cópia do inventário da área a ser explorada (obrigatório se >50 ha)",
  cadastro_tecnico_federal: "Cópia do Cadastro Técnico Federal",
  inscricao_estadual: "Cópia do registro de inscrição estadual referente ao imóvel explorado",
  shapefile: "Arquivo shapefile da área",
  outro: "Outro documento relevante",
}

export const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const
