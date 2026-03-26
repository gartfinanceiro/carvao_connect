import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export interface DischargeTicketData {
  org: {
    name: string
    document?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    phone?: string | null
    state_registration?: string | null
  }
  supplier: {
    name: string
    document?: string | null
    person_type?: "pf" | "pj" | null
    bank_name?: string | null
    bank_agency?: string | null
    bank_account?: string | null
  }
  discharge: {
    discharge_number?: number | null
    discharge_date: string
    volume_mdc: number
    gross_weight_kg?: number | null
    tare_weight_kg?: number | null
    net_weight_kg?: number | null
    density_kg_mdc?: number | null
    moisture_percent?: number | null
    fines_kg?: number | null
    fines_percent?: number | null
    price_per_mdc: number
    gross_total?: number | null
    deductions?: number | null
    net_total?: number | null
    funrural_percent?: number | null
    funrural_value?: number | null
    truck_plate?: string | null
    invoice_number?: string | null
    forest_guide?: string | null
    charcoal_type?: string | null
    pricing_unit?: 'mdc' | 'ton' | null
    notes?: string | null
  }
}

// ── Formatters ──────────────────────────────────────────────────
function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}

function fmtCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("pt-BR")
}

function fmtDoc(doc: string | null | undefined, type?: "pf" | "pj" | null): string {
  if (!doc) return "—"
  const digits = doc.replace(/\D/g, "")
  if (digits.length === 11 || type === "pf") {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  }
  if (digits.length === 14 || type === "pj") {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
  }
  return doc
}

// ── Colors (matching project palette) ───────────────────────────
const GREEN = [27, 67, 50] as const       // #1B4332
const GRAY_800 = [55, 65, 81] as const
const GRAY_500 = [107, 114, 128] as const
const GRAY_400 = [156, 163, 175] as const
const LIGHT_BG = [248, 248, 247] as const

// ── Main function ───────────────────────────────────────────────
export function generateDischargeTicket(data: DischargeTicketData): void {
  const { org, supplier, discharge: d } = data
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // ── Helper: section header ────────────────────────────────────
  function sectionHeader(title: string) {
    doc.setFillColor(...GREEN)
    doc.rect(margin, y, contentWidth, 6, "F")
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(255, 255, 255)
    doc.text(title.toUpperCase(), margin + 3, y + 4.2)
    y += 8
  }

  // ── Helper: key-value row ─────────────────────────────────────
  function kvRow(label: string, value: string, x: number = margin + 3, width: number = contentWidth - 6) {
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...GRAY_500)
    doc.text(label, x, y)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...GRAY_800)
    doc.text(value, x + width, y, { align: "right" })
    y += 4.5
  }

  // ── Helper: two columns ───────────────────────────────────────
  function kvRowTwo(label1: string, val1: string, label2: string, val2: string) {
    const half = (contentWidth - 6) / 2
    const x1 = margin + 3
    const x2 = margin + 3 + half + 4

    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...GRAY_500)
    doc.text(label1, x1, y)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...GRAY_800)
    doc.text(val1, x1 + half - 4, y, { align: "right" })

    doc.setFont("helvetica", "normal")
    doc.setTextColor(...GRAY_500)
    doc.text(label2, x2, y)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...GRAY_800)
    doc.text(val2, x2 + half - 4, y, { align: "right" })

    y += 4.5
  }

  // ── Helper: separator line ────────────────────────────────────
  function separator() {
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.2)
    doc.line(margin, y, pageWidth - margin, y)
    y += 2
  }

  // ════════════════════════════════════════════════════════════════
  // HEADER — Organization
  // ════════════════════════════════════════════════════════════════
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...GREEN)
  doc.text(org.name || "EMPRESA", margin, y)
  y += 5

  // Sub-info line
  const orgParts: string[] = []
  if (org.document) orgParts.push(`CNPJ: ${fmtDoc(org.document, "pj")}`)
  if (org.state_registration) orgParts.push(`IE: ${org.state_registration}`)
  if (org.phone) orgParts.push(`Tel: ${org.phone}`)

  if (orgParts.length > 0) {
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...GRAY_500)
    doc.text(orgParts.join("   |   "), margin, y)
    y += 4
  }

  if (org.address || org.city) {
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...GRAY_500)
    const addrParts = [org.address, org.city, org.state].filter(Boolean).join(" — ")
    doc.text(addrParts, margin, y)
    y += 4
  }

  // Title + Number
  y += 2
  separator()
  y += 1

  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...GRAY_800)
  const ticketTitle = d.discharge_number
    ? `TICKET DE DESCARGA  Nº ${String(d.discharge_number).padStart(4, "0")}`
    : "TICKET DE DESCARGA"
  doc.text(ticketTitle, pageWidth / 2, y, { align: "center" })
  y += 6

  separator()
  y += 2

  // ════════════════════════════════════════════════════════════════
  // SECTION: Fornecedor
  // ════════════════════════════════════════════════════════════════
  sectionHeader("Fornecedor")
  kvRow("Nome", supplier.name)
  if (supplier.document) {
    const docLabel = supplier.person_type === "pf" ? "CPF" : "CNPJ"
    kvRow(docLabel, fmtDoc(supplier.document, supplier.person_type))
  }
  y += 1

  // ════════════════════════════════════════════════════════════════
  // SECTION: Dados da Carga
  // ════════════════════════════════════════════════════════════════
  sectionHeader("Dados da Carga")
  kvRowTwo("Data", fmtDate(d.discharge_date), "Placa", d.truck_plate || "—")
  kvRowTwo("Nota Fiscal", d.invoice_number || "—", "Guia Florestal", d.forest_guide || "—")
  if (d.charcoal_type) {
    kvRow("Tipo de carvão", d.charcoal_type)
  }
  y += 1

  // ════════════════════════════════════════════════════════════════
  // SECTION: Pesagem e Qualidade
  // ════════════════════════════════════════════════════════════════
  sectionHeader("Pesagem e Qualidade")

  // Weight table
  const netWt = Number(d.net_weight_kg) || 0
  const finesKg = Number(d.fines_kg) || 0
  const densityTimesVol = (Number(d.density_kg_mdc) || 0) * (Number(d.volume_mdc) || 0)
  const moistureDeductionKg = netWt > 0 && densityTimesVol > 0
    ? Math.max(netWt - finesKg - densityTimesVol, 0)
    : 0

  const weightData: string[][] = []
  if (d.gross_weight_kg) weightData.push(["Peso bruto", `${fmt(Number(d.gross_weight_kg))} kg`])
  if (d.tare_weight_kg) weightData.push(["Tara", `${fmt(Number(d.tare_weight_kg))} kg`])
  if (d.net_weight_kg) weightData.push(["Peso líquido", `${fmt(netWt)} kg`])
  if (Number(d.moisture_percent) > 0) {
    weightData.push(["Umidade", `${d.moisture_percent}%`])
    if (moistureDeductionKg > 0) {
      weightData.push(["  Desc. umidade", `-${fmt(Math.round(moistureDeductionKg))} kg`])
    }
  }
  if (finesKg > 0) {
    weightData.push(["Impurezas (moinha)", `${fmt(finesKg)} kg (${d.fines_percent ?? 0}%)`])
  }
  weightData.push(["Volume", `${fmt(d.volume_mdc)} MDC`])
  if (d.density_kg_mdc) weightData.push(["Densidade", `${fmt(Number(d.density_kg_mdc))} kg/MDC`])

  autoTable(doc, {
    startY: y,
    body: weightData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 } },
    columnStyles: {
      0: { fontStyle: "normal", textColor: [...GRAY_500] as [number, number, number], cellWidth: 55 },
      1: { fontStyle: "bold", textColor: [...GRAY_800] as [number, number, number], halign: "right" },
    },
    alternateRowStyles: { fillColor: [...LIGHT_BG] as [number, number, number] },
    theme: "plain",
    didDrawCell(data) {
      // Bottom border on each row
      if (data.column.index === 1) {
        doc.setDrawColor(235, 235, 235)
        doc.setLineWidth(0.15)
        doc.line(
          data.cell.x - data.cell.width - 3,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        )
      }
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 4

  // ════════════════════════════════════════════════════════════════
  // SECTION: Valores
  // ════════════════════════════════════════════════════════════════
  sectionHeader("Valores")

  const pUnit = d.pricing_unit || "mdc"
  const priceLabel = pUnit === "ton" ? "Preço por tonelada" : "Preço por MDC"
  kvRow(priceLabel, fmtCurrency(d.price_per_mdc))

  // Show billing breakdown
  if (pUnit === "ton" && densityTimesVol > 0) {
    const adjWeightTon = Math.round(densityTimesVol) / 1000
    kvRow("Base de cálculo", `${adjWeightTon.toFixed(2)} ton x ${fmtCurrency(d.price_per_mdc)}`)
  } else {
    kvRow("Base de cálculo", `${fmt(d.volume_mdc)} MDC x ${fmtCurrency(d.price_per_mdc)}`)
  }

  kvRow("Valor bruto", fmtCurrency(d.gross_total))

  if (Number(d.deductions) > 0) {
    kvRow("Descontos", `-${fmtCurrency(d.deductions)}`)
  }

  kvRow("Valor líquido", fmtCurrency(d.net_total))

  if (Number(d.funrural_percent) > 0 && Number(d.funrural_value) > 0) {
    kvRow(`FUNRURAL (${d.funrural_percent}%)`, `-${fmtCurrency(d.funrural_value)}`)
  }

  // Value to pay — highlighted
  y += 1
  const valorPagar = (Number(d.net_total) || 0) - (Number(d.funrural_value) || 0)
  doc.setFillColor(245, 245, 244)
  doc.roundedRect(margin, y - 1, contentWidth, 9, 1.5, 1.5, "F")
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...GREEN)
  doc.text("VALOR A PAGAR", margin + 3, y + 5)
  doc.setFontSize(11)
  doc.text(fmtCurrency(valorPagar), pageWidth - margin - 3, y + 5, { align: "right" })
  y += 13

  // ════════════════════════════════════════════════════════════════
  // SECTION: Dados Bancários (if available)
  // ════════════════════════════════════════════════════════════════
  if (supplier.bank_name || supplier.bank_agency || supplier.bank_account) {
    sectionHeader("Dados Bancários do Fornecedor")
    if (supplier.bank_name) kvRow("Banco", supplier.bank_name)
    if (supplier.bank_agency) kvRow("Agência", supplier.bank_agency)
    if (supplier.bank_account) kvRow("Conta", supplier.bank_account)
    if (supplier.document) {
      const label = supplier.person_type === "pf" ? "CPF titular" : "CNPJ titular"
      kvRow(label, fmtDoc(supplier.document, supplier.person_type))
    }
    y += 1
  }

  // ════════════════════════════════════════════════════════════════
  // Notes
  // ════════════════════════════════════════════════════════════════
  if (d.notes) {
    y += 2
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...GRAY_500)
    doc.text("Observações:", margin + 3, y)
    y += 4
    doc.setTextColor(...GRAY_800)
    const lines = doc.splitTextToSize(d.notes, contentWidth - 6)
    doc.text(lines, margin + 3, y)
    y += lines.length * 3.5 + 2
  }

  // ════════════════════════════════════════════════════════════════
  // Signature lines
  // ════════════════════════════════════════════════════════════════
  y = Math.max(y + 10, 230)
  const sigWidth = (contentWidth - 20) / 2

  doc.setDrawColor(...GRAY_400)
  doc.setLineWidth(0.3)

  // Left signature
  doc.line(margin, y, margin + sigWidth, y)
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...GRAY_500)
  doc.text("Fornecedor", margin + sigWidth / 2, y + 4, { align: "center" })

  // Right signature
  const rightX = pageWidth - margin - sigWidth
  doc.line(rightX, y, pageWidth - margin, y)
  doc.text("Responsável", rightX + sigWidth / 2, y + 4, { align: "center" })

  // ════════════════════════════════════════════════════════════════
  // Footer
  // ════════════════════════════════════════════════════════════════
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(6.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...GRAY_400)
  doc.text("Gerado por Carvão Connect · carvaoconnect.com.br", margin, pageHeight - 8)
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    pageWidth - margin,
    pageHeight - 8,
    { align: "right" }
  )

  // Open in new tab
  const pdfBlob = doc.output("blob")
  const url = URL.createObjectURL(pdfBlob)
  window.open(url, "_blank")
}
