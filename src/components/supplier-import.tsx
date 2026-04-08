"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { validateDocument, validatePhone } from "@/lib/utils"
import { UF_OPTIONS } from "@/lib/labels"
import * as XLSX from "xlsx"
import type { PersonType } from "@/types/database"

// ── Types ──────────────────────────────────────────────────────────
interface ImportRow {
  rowNum: number
  name: string
  document: string
  person_type: PersonType
  contact_name: string
  phones: string[]
  city: string
  state: string
  avg_density: number | null
  monthly_capacity: number | null
  contracted_loads: number
  last_price: number | null
  dcf_number: string
  dcf_issue_date: string | null
  notes: string
  errors: string[]
  warnings: string[]
}

type ImportStep = "upload" | "preview" | "importing" | "done"

interface ImportResult {
  total: number
  success: number
  failed: number
  errors: { row: number; name: string; error: string }[]
}

interface SupplierImportProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  currentCount: number
  maxCount: number
}

// ── Column mapping (PT-BR header → field) ─────────────────────────
const COLUMN_MAP: Record<string, keyof Omit<ImportRow, "rowNum" | "errors" | "warnings">> = {
  "nome": "name",
  "nome / razão social": "name",
  "razão social": "name",
  "cpf/cnpj": "document",
  "cpf_cnpj": "document",
  "cpf": "document",
  "cnpj": "document",
  "documento": "document",
  "tipo": "person_type",
  "tipo pessoa": "person_type",
  "pf/pj": "person_type",
  "negociador": "contact_name",
  "contato": "contact_name",
  "pessoa de contato": "contact_name",
  "telefone": "phones",
  "telefones": "phones",
  "telefone(s)": "phones",
  "cidade": "city",
  "uf": "state",
  "estado": "state",
  "densidade": "avg_density",
  "densidade média": "avg_density",
  "densidade média (kg/mdc)": "avg_density",
  "densidade media": "avg_density",
  "densidade media (kg/mdc)": "avg_density",
  "capacidade": "monthly_capacity",
  "capacidade mensal": "monthly_capacity",
  "capacidade mensal (cargas)": "monthly_capacity",
  "cargas contratadas": "contracted_loads",
  "contratadas": "contracted_loads",
  "preço": "last_price",
  "preco": "last_price",
  "preço última compra": "last_price",
  "preco ultima compra": "last_price",
  "preço (r$/mdc)": "last_price",
  "preco (r$/mdc)": "last_price",
  "número dcf": "dcf_number",
  "numero dcf": "dcf_number",
  "dcf número": "dcf_number",
  "dcf numero": "dcf_number",
  "nº dcf": "dcf_number",
  "data dcf": "dcf_issue_date",
  "emissão dcf": "dcf_issue_date",
  "emissao dcf": "dcf_issue_date",
  "dcf": "dcf_issue_date",
  "observações": "notes",
  "observacoes": "notes",
  "notas": "notes",
  "obs": "notes",
}

// ── Template generation ────────────────────────────────────────────
function generateTemplate() {
  const headers = [
    "Nome / Razão Social",
    "CPF/CNPJ",
    "Número DCF",
    "Tipo (PF/PJ)",
    "Negociador",
    "Telefone(s)",
    "Cidade",
    "UF",
    "Densidade Média (kg/mdc)",
    "Capacidade Mensal (cargas)",
    "Cargas Contratadas",
    "Preço (R$/mdc)",
    "Emissão DCF",
    "Observações",
  ]

  const exampleRows = [
    [
      "Carbonífera Vale Verde",
      "12.345.678/0001-99",
      "DCF-001234/2024",
      "PJ",
      "José Silva",
      "(31) 99999-8888 / (31) 3333-4444",
      "Sete Lagoas",
      "MG",
      220,
      8,
      4,
      85.0,
      "2025-01-15",
      "Fornecedor parceiro há 3 anos",
    ],
    [
      "João da Silva",
      "123.456.789-00",
      "PF",
      "",
      "(38) 98888-7777",
      "Curvelo",
      "MG",
      200,
      3,
      0,
      "",
      "",
      "",
    ],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows])

  // Column widths
  ws["!cols"] = [
    { wch: 30 }, // Nome
    { wch: 22 }, // CPF/CNPJ
    { wch: 10 }, // Tipo
    { wch: 20 }, // Negociador
    { wch: 35 }, // Telefones
    { wch: 18 }, // Cidade
    { wch: 6 },  // UF
    { wch: 22 }, // Densidade
    { wch: 22 }, // Capacidade
    { wch: 18 }, // Contratadas
    { wch: 15 }, // Preço
    { wch: 14 }, // DCF
    { wch: 35 }, // Obs
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Fornecedores")

  // Instructions sheet
  const instrRows = [
    ["Instruções para Importação de Fornecedores — Carvão Connect"],
    [""],
    ["Campo", "Obrigatório", "Formato", "Observações"],
    ["Nome / Razão Social", "Sim", "Texto", "Nome completo do fornecedor ou razão social"],
    ["CPF/CNPJ", "Sim", "Numérico", "Aceita formatado (pontos, traços) ou só números. 11 dígitos = CPF, 14 = CNPJ"],
    ["Tipo (PF/PJ)", "Não", "PF ou PJ", "Se vazio, será detectado automaticamente pelo CPF/CNPJ"],
    ["Negociador", "Não", "Texto", "Nome da pessoa de contato / negociador"],
    ["Telefone(s)", "Sim", "Numérico", "Mínimo 10 dígitos. Múltiplos separados por / ou ;"],
    ["Cidade", "Sim", "Texto", ""],
    ["UF", "Sim", "2 letras", "Ex: MG, SP, BA, GO..."],
    ["Densidade Média (kg/mdc)", "Sim", "Número", "Entre 100 e 400"],
    ["Capacidade Mensal (cargas)", "Sim", "Número inteiro", "Mínimo 1"],
    ["Cargas Contratadas", "Não", "Número inteiro", "Padrão: 0"],
    ["Preço (R$/mdc)", "Não", "Número decimal", "Ex: 85.00"],
    ["Emissão DCF", "Não", "Data YYYY-MM-DD", "Data de emissão da DCF. Vencimento calculado automaticamente (+3 anos)"],
    ["Observações", "Não", "Texto", ""],
  ]
  const wsInstr = XLSX.utils.aoa_to_sheet(instrRows)
  wsInstr["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 20 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções")

  XLSX.writeFile(wb, "template_fornecedores_carvao_connect.xlsx")
}

// ── Parse helpers ──────────────────────────────────────────────────
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ")
}

function parsePhones(value: string): string[] {
  if (!value) return []
  // Split by / ; , or |
  return value
    .split(/[\/;,|]+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function parseDate(value: unknown): string | null {
  if (!value) return null
  // If it's a JS Date (from Excel serial)
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, "0")
    const d = String(value.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  const str = String(value).trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  // DD/MM/YYYY
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
  return null
}

function parsePersonType(value: string, document: string): PersonType {
  const v = value?.trim().toLowerCase()
  if (v === "pf" || v === "pessoa física" || v === "pessoa fisica") return "pf"
  if (v === "pj" || v === "pessoa jurídica" || v === "pessoa juridica") return "pj"
  // Auto-detect from document
  const digits = document.replace(/\D/g, "")
  return digits.length === 11 ? "pf" : "pj"
}

// ── Row validation ─────────────────────────────────────────────────
function validateRow(row: ImportRow): ImportRow {
  const errors: string[] = []
  const warnings: string[] = []

  // Required fields
  if (!row.name.trim()) errors.push("Nome é obrigatório")
  if (!row.document.trim()) {
    errors.push("CPF/CNPJ é obrigatório")
  } else if (!validateDocument(row.document)) {
    errors.push("CPF deve ter 11 dígitos ou CNPJ 14 dígitos")
  }

  if (row.phones.length === 0 || row.phones.every((p) => !p.trim())) {
    errors.push("Telefone é obrigatório")
  } else {
    for (const phone of row.phones) {
      if (phone.trim() && !validatePhone(phone)) {
        errors.push(`Telefone "${phone}" deve ter pelo menos 10 dígitos`)
        break
      }
    }
  }

  if (!row.city.trim()) errors.push("Cidade é obrigatória")

  if (!row.state.trim()) {
    errors.push("UF é obrigatória")
  } else if (!UF_OPTIONS.includes(row.state.toUpperCase() as typeof UF_OPTIONS[number])) {
    errors.push(`UF "${row.state}" inválida`)
  }

  if (row.avg_density === null) {
    errors.push("Densidade é obrigatória")
  } else if (row.avg_density < 100 || row.avg_density > 400) {
    errors.push("Densidade deve ser entre 100 e 400 kg/mdc")
  }

  if (row.monthly_capacity === null) {
    errors.push("Capacidade mensal é obrigatória")
  } else if (row.monthly_capacity < 1) {
    errors.push("Capacidade mínima: 1 carga")
  }

  // Warnings (non-blocking)
  if (!row.contact_name) warnings.push("Sem negociador")
  if (row.last_price === null) warnings.push("Sem preço")
  if (!row.dcf_number.trim()) warnings.push("Sem número DCF")
  if (!row.dcf_issue_date) warnings.push("Sem data de emissão DCF")

  return { ...row, errors, warnings }
}

// ── Parse spreadsheet ──────────────────────────────────────────────
function parseSpreadsheet(data: ArrayBuffer): ImportRow[] {
  const wb = XLSX.read(data, { type: "array", cellDates: true })
  // Use first sheet (skip "Instruções" if present)
  const sheetName = wb.SheetNames.find(
    (n) => n.toLowerCase() !== "instruções" && n.toLowerCase() !== "instrucoes"
  ) || wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })

  if (jsonRows.length === 0) return []

  // Map headers
  const firstRow = jsonRows[0]
  const headerMap: Record<string, string> = {}
  for (const key of Object.keys(firstRow)) {
    const normalized = normalizeHeader(key)
    const field = COLUMN_MAP[normalized]
    if (field) {
      headerMap[key] = field
    }
  }

  return jsonRows.map((raw, index): ImportRow => {
    const get = (field: string): string => {
      for (const [key, mappedField] of Object.entries(headerMap)) {
        if (mappedField === field) {
          const val = raw[key]
          if (val instanceof Date) return parseDate(val) || ""
          return String(val ?? "").trim()
        }
      }
      return ""
    }

    const getNum = (field: string): number | null => {
      const v = get(field)
      if (!v) return null
      const n = Number(v.replace(",", "."))
      return isNaN(n) ? null : n
    }

    const document = get("document").replace(/\D/g, "")
    const personType = parsePersonType(get("person_type"), document)
    const phones = parsePhones(get("phones"))

    const row: ImportRow = {
      rowNum: index + 2, // +2 because row 1 is header, data starts at 2
      name: get("name"),
      document,
      person_type: personType,
      contact_name: get("contact_name"),
      phones: phones.length > 0 ? phones : [""],
      city: get("city"),
      state: get("state").toUpperCase(),
      avg_density: getNum("avg_density"),
      monthly_capacity: getNum("monthly_capacity"),
      contracted_loads: getNum("contracted_loads") ?? 0,
      last_price: getNum("last_price"),
      dcf_number: get("dcf_number"),
      dcf_issue_date: parseDate(get("dcf_issue_date")),
      notes: get("notes"),
      errors: [],
      warnings: [],
    }

    return validateRow(row)
  })
}

// ── Preview pagination ─────────────────────────────────────────────
const PREVIEW_PAGE_SIZE = 10

// ── Component ──────────────────────────────────────────────────────
export function SupplierImport({
  open,
  onOpenChange,
  onSuccess,
  currentCount,
  maxCount,
}: SupplierImportProps) {
  const [step, setStep] = useState<ImportStep>("upload")
  const [rows, setRows] = useState<ImportRow[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [previewPage, setPreviewPage] = useState(1)
  const [fileName, setFileName] = useState("")

  const validRows = rows.filter((r) => r.errors.length === 0)
  const errorRows = rows.filter((r) => r.errors.length > 0)
  const slotsAvailable = maxCount - currentCount

  function reset() {
    setStep("upload")
    setRows([])
    setResult(null)
    setImporting(false)
    setPreviewPage(1)
    setFileName("")
  }

  function handleClose(open: boolean) {
    if (!open) reset()
    onOpenChange(open)
  }

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset input so same file can be re-selected
    e.target.value = ""
  }

  function processFile(file: File) {
    const validExtensions = [".xlsx", ".xls", ".csv"]
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
    if (!validExtensions.includes(ext)) {
      toast.error("Formato inválido. Use .xlsx, .xls ou .csv")
      return
    }

    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result as ArrayBuffer
        const parsed = parseSpreadsheet(data)

        if (parsed.length === 0) {
          toast.error("Planilha vazia ou sem dados válidos")
          return
        }

        setRows(parsed)
        setPreviewPage(1)
        setStep("preview")
      } catch {
        toast.error("Erro ao ler planilha. Verifique o formato do arquivo.")
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (validRows.length === 0) return

    const toImport = validRows.slice(0, slotsAvailable)
    setImporting(true)
    setStep("importing")

    const supabase = createClient()
    const results: ImportResult = {
      total: toImport.length,
      success: 0,
      failed: 0,
      errors: [],
    }

    // Check for duplicate documents within the batch
    const seenDocs = new Set<string>()
    const uniqueRows = toImport.filter((row) => {
      if (seenDocs.has(row.document)) {
        results.failed++
        results.errors.push({
          row: row.rowNum,
          name: row.name,
          error: "CPF/CNPJ duplicado na planilha",
        })
        return false
      }
      seenDocs.add(row.document)
      return true
    })

    // Batch insert in chunks of 20
    const BATCH_SIZE = 20
    for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
      const batch = uniqueRows.slice(i, i + BATCH_SIZE)
      const payloads = batch.map((row) => ({
        name: row.name.trim(),
        document: row.document,
        person_type: row.person_type,
        contact_name: row.contact_name.trim() || null,
        phones: row.phones.filter((p) => p.trim()),
        city: row.city.trim(),
        state: row.state.toUpperCase(),
        avg_density: row.avg_density,
        monthly_capacity: row.monthly_capacity,
        contracted_loads: row.contracted_loads,
        last_price: row.last_price,
        dcf_number: row.dcf_number.trim() || null,
        dcf_issue_date: row.dcf_issue_date,
        notes: row.notes.trim() || null,
      }))

      const { error, data } = await supabase.from("suppliers").insert(payloads).select("id")

      if (error) {
        // Try one by one to identify which failed
        for (const row of batch) {
          const payload = {
            name: row.name.trim(),
            document: row.document,
            person_type: row.person_type,
            contact_name: row.contact_name.trim() || null,
            phones: row.phones.filter((p) => p.trim()),
            city: row.city.trim(),
            state: row.state.toUpperCase(),
            avg_density: row.avg_density,
            monthly_capacity: row.monthly_capacity,
            contracted_loads: row.contracted_loads,
            last_price: row.last_price,
            dcf_number: row.dcf_number.trim() || null,
            dcf_issue_date: row.dcf_issue_date,
            notes: row.notes.trim() || null,
          }
          const { error: singleError } = await supabase
            .from("suppliers")
            .insert(payload)

          if (singleError) {
            results.failed++
            results.errors.push({
              row: row.rowNum,
              name: row.name,
              error: singleError.message.includes("duplicate")
                ? "CPF/CNPJ já cadastrado no sistema"
                : singleError.message,
            })
          } else {
            results.success++
          }
        }
      } else {
        results.success += data?.length ?? batch.length
      }
    }

    setResult(results)
    setImporting(false)
    setStep("done")

    if (results.success > 0) {
      onSuccess()
    }
  }

  // ── Preview pagination helpers ───────────────────────────────────
  const totalPreviewPages = Math.ceil(rows.length / PREVIEW_PAGE_SIZE)
  const previewRows = rows.slice(
    (previewPage - 1) * PREVIEW_PAGE_SIZE,
    previewPage * PREVIEW_PAGE_SIZE
  )

  // ── Render ───────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar fornecedores
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Faça upload de uma planilha Excel ou CSV com os dados dos fornecedores."}
            {step === "preview" && `${rows.length} linha(s) encontradas — revise antes de importar.`}
            {step === "importing" && "Importando fornecedores..."}
            {step === "done" && "Importação concluída."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step: Upload ──────────────────────────────────────── */}
        {step === "upload" && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center hover:border-[#1B4332]/40 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => document.getElementById("import-file-input")?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                Arraste uma planilha aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Formatos aceitos: .xlsx, .xls, .csv
              </p>
              <input
                id="import-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Plan limit info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                Seu plano permite {maxCount} fornecedores. Você tem {currentCount} cadastrados
                ({slotsAvailable} vagas disponíveis).
              </span>
            </div>

            {/* Download template */}
            <div className="flex items-center justify-between border rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium">Precisa de um modelo?</p>
                <p className="text-xs text-muted-foreground">
                  Baixe o template com as colunas corretas e exemplos
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={generateTemplate}
                className="shrink-0"
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                Baixar template
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Preview ─────────────────────────────────────── */}
        {step === "preview" && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-center">
                <p className="text-lg font-bold">{rows.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className={`rounded-lg px-3 py-2 text-center ${
                validRows.length > 0 ? "bg-emerald-50" : "bg-muted/50"
              }`}>
                <p className={`text-lg font-bold ${validRows.length > 0 ? "text-emerald-600" : ""}`}>
                  {validRows.length}
                </p>
                <p className="text-xs text-muted-foreground">Válidos</p>
              </div>
              <div className={`rounded-lg px-3 py-2 text-center ${
                errorRows.length > 0 ? "bg-red-50" : "bg-muted/50"
              }`}>
                <p className={`text-lg font-bold ${errorRows.length > 0 ? "text-red-500" : ""}`}>
                  {errorRows.length}
                </p>
                <p className="text-xs text-muted-foreground">Com erros</p>
              </div>
            </div>

            {/* Limit warning */}
            {validRows.length > slotsAvailable && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Apenas {slotsAvailable} de {validRows.length} fornecedores válidos serão importados
                  (limite do plano: {maxCount}).
                </span>
              </div>
            )}

            {/* Preview table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Dens.</TableHead>
                      <TableHead className="text-right">Cap.</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row) => (
                      <TableRow
                        key={row.rowNum}
                        className={row.errors.length > 0 ? "bg-red-50/50" : ""}
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          {row.rowNum}
                        </TableCell>
                        <TableCell>
                          {row.errors.length > 0 ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : row.warnings.length > 0 ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-sm max-w-[180px] truncate">
                          {row.name || <span className="text-red-400 italic">vazio</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {row.document || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.city ? `${row.city}/${row.state}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.phones.filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {row.avg_density ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {row.monthly_capacity ?? "—"}
                        </TableCell>
                        <TableCell>
                          {row.errors.length > 0 ? (
                            <div className="space-y-0.5">
                              {row.errors.map((err, i) => (
                                <p key={i} className="text-xs text-red-500 leading-tight">
                                  {err}
                                </p>
                              ))}
                            </div>
                          ) : row.warnings.length > 0 ? (
                            <div className="space-y-0.5">
                              {row.warnings.map((w, i) => (
                                <p key={i} className="text-xs text-amber-600 leading-tight">
                                  {w}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-emerald-600">OK</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPreviewPages > 1 && (
                <div className="flex items-center justify-between border-t px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    Página {previewPage} de {totalPreviewPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={previewPage === 1}
                      onClick={() => setPreviewPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={previewPage === totalPreviewPages}
                      onClick={() => setPreviewPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="mr-1 h-3.5 w-3.5" />
                Escolher outro arquivo
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-[#1B4332] hover:bg-[#2D6A4F]"
                  disabled={validRows.length === 0}
                  onClick={handleImport}
                >
                  Importar {Math.min(validRows.length, slotsAvailable)} fornecedor(es)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: Importing ───────────────────────────────────── */}
        {step === "importing" && (
          <div className="flex flex-col items-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
            <p className="text-sm text-muted-foreground">
              Importando fornecedores, aguarde...
            </p>
          </div>
        )}

        {/* ── Step: Done ────────────────────────────────────────── */}
        {step === "done" && result && (
          <div className="space-y-4">
            <div className="text-center py-4">
              {result.success > 0 ? (
                <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
              ) : (
                <XCircle className="h-12 w-12 mx-auto text-red-500 mb-3" />
              )}
              <p className="text-lg font-semibold">
                {result.success} de {result.total} importados com sucesso
              </p>
              {result.failed > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {result.failed} não puderam ser importados
                </p>
              )}
            </div>

            {/* Error details */}
            {result.errors.length > 0 && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <div key={i} className="px-3 py-2 flex items-start gap-2">
                    <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">
                        Linha {err.row} — {err.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{err.error}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                className="bg-[#1B4332] hover:bg-[#2D6A4F]"
                onClick={() => handleClose(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
