import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { convertVolume, convertPrice, unitLabel, priceUnitLabel } from "@/lib/utils"
import type { VolumeUnit } from "@/lib/utils"
import type { Discharge } from "@/types/database"

export interface ReportOptions {
  period: { start: string; end: string; label: string }
  supplierFilter: string | null
  supplierName: string | null
  columns: {
    moisture: boolean
    fines: boolean
    deductions: boolean
    plate: boolean
    invoice: boolean
    forestGuide: boolean
  }
  includeSummary: boolean
  groupBySupplier: boolean
  organizationName: string
  unit?: VolumeUnit
}

export interface ReportDischarge extends Discharge {
  supplier?: { name: string }
}

function formatDateBR(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("pt-BR")
}

function formatCurrencyPDF(value: number | null): string {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

export function generateDischargeReport(
  discharges: ReportDischarge[],
  options: ReportOptions,
) {
  const u = options.unit ?? "mdc"
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let yPos = margin

  // Header
  doc.setFontSize(18)
  doc.setTextColor(27, 67, 50) // #1B4332
  doc.setFont("helvetica", "bold")
  doc.text("CARVÃO CONNECT", margin, yPos)
  yPos += 8

  doc.setFontSize(12)
  doc.setTextColor(55, 65, 81)
  doc.setFont("helvetica", "normal")
  doc.text("Relatório de Descargas", margin, yPos)
  yPos += 7

  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  doc.text(`Período: ${options.period.label}`, margin, yPos)
  yPos += 5
  if (options.organizationName) {
    doc.text(`Organização: ${options.organizationName}`, margin, yPos)
    yPos += 5
  }
  doc.text(
    `Fornecedor: ${options.supplierName ?? "Todos"}`,
    margin,
    yPos,
  )
  yPos += 5
  doc.text(
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    margin,
    yPos,
  )
  yPos += 8

  // Summary block
  if (options.includeSummary && discharges.length > 0) {
    const totalVolume = discharges.reduce((s, d) => s + convertVolume(Number(d.volume_mdc), d.density_kg_mdc, u), 0)
    const totalGross = discharges.reduce((s, d) => s + Number(d.gross_total ?? 0), 0)
    const totalDeductions = discharges.reduce((s, d) => s + Number(d.deductions ?? 0), 0)
    const totalNet = discharges.reduce((s, d) => s + Number(d.net_total ?? 0), 0)
    const densities = discharges
      .map((d) => Number(d.density_kg_mdc))
      .filter((v) => v > 0)
    const avgDensity =
      densities.length > 0
        ? Math.round(densities.reduce((a, b) => a + b, 0) / densities.length)
        : null
    const moistures = discharges.map((d) => Number(d.moisture_percent)).filter((v) => v > 0)
    const avgMoisture =
      moistures.length > 0
        ? Math.round((moistures.reduce((a, b) => a + b, 0) / moistures.length) * 10) / 10
        : null
    const fines = discharges.map((d) => Number(d.fines_percent)).filter((v) => v > 0)
    const avgFines =
      fines.length > 0
        ? Math.round((fines.reduce((a, b) => a + b, 0) / fines.length) * 10) / 10
        : null

    // Draw summary box
    doc.setFillColor(245, 245, 244)
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 28, 2, 2, "F")
    yPos += 5

    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(107, 114, 128)
    doc.text("RESUMO", margin + 4, yPos)
    yPos += 5

    doc.setFont("helvetica", "normal")
    doc.setTextColor(55, 65, 81)
    doc.setFontSize(8)

    const summaryItems = [
      `Descargas: ${discharges.length}`,
      `Volume: ${(Math.round(totalVolume * 10) / 10).toLocaleString("pt-BR")} ${unitLabel(u)}`,
      `Bruto: ${formatCurrencyPDF(totalGross)}`,
      `Descontos: ${formatCurrencyPDF(totalDeductions)} (${totalGross > 0 ? ((totalDeductions / totalGross) * 100).toFixed(1) : "0"}%)`,
      `Líquido: ${formatCurrencyPDF(totalNet)}`,
    ]

    const summaryItems2 = [
      avgDensity !== null ? `Densidade média: ${avgDensity} kg/mdc` : null,
      avgMoisture !== null ? `Umidade média: ${avgMoisture}%` : null,
      avgFines !== null ? `Moinha média: ${avgFines}%` : null,
    ].filter(Boolean) as string[]

    doc.text(summaryItems.join("   |   "), margin + 4, yPos)
    yPos += 4
    if (summaryItems2.length > 0) {
      doc.text(summaryItems2.join("   |   "), margin + 4, yPos)
    }
    yPos += 12
  }

  // Build columns
  const headers: string[] = ["Data", "Fornecedor", `Volume (${unitLabel(u)})`, "Densidade", `Preço (${priceUnitLabel(u)})`]
  if (options.columns.moisture) headers.push("Umidade")
  if (options.columns.fines) headers.push("Moinha")
  headers.push("Bruto")
  if (options.columns.deductions) headers.push("Descontos")
  headers.push("Líquido")
  if (options.columns.plate) headers.push("Placa")
  if (options.columns.invoice) headers.push("NF")
  if (options.columns.forestGuide) headers.push("Guia")

  function buildRow(d: ReportDischarge): string[] {
    const row: string[] = [
      formatDateBR(d.discharge_date),
      d.supplier?.name ?? "—",
      `${convertVolume(Number(d.volume_mdc), d.density_kg_mdc, u)}`,
      d.density_kg_mdc ? `${d.density_kg_mdc}` : "—",
      formatCurrencyPDF(convertPrice(d.price_per_mdc, d.density_kg_mdc, u)),
    ]
    if (options.columns.moisture)
      row.push(Number(d.moisture_percent) > 0 ? `${d.moisture_percent}%` : "—")
    if (options.columns.fines)
      row.push(Number(d.fines_percent) > 0 ? `${d.fines_percent}%` : "—")
    row.push(formatCurrencyPDF(d.gross_total))
    if (options.columns.deductions)
      row.push(
        Number(d.deductions) > 0
          ? `-${formatCurrencyPDF(d.deductions)}`
          : "—",
      )
    row.push(formatCurrencyPDF(d.net_total))
    if (options.columns.plate) row.push(d.truck_plate || "—")
    if (options.columns.invoice) row.push(d.invoice_number || "—")
    if (options.columns.forestGuide) row.push(d.forest_guide || "—")
    return row
  }

  if (options.groupBySupplier) {
    // Group by supplier
    const groups = new Map<string, ReportDischarge[]>()
    for (const d of discharges) {
      const name = d.supplier?.name ?? "Sem fornecedor"
      const group = groups.get(name) ?? []
      group.push(d)
      groups.set(name, group)
    }

    for (const [name, items] of groups) {
      // Supplier header
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(27, 67, 50)
      doc.text(`${name} (${items.length} descarga${items.length > 1 ? "s" : ""})`, margin, yPos)
      yPos += 2

      const body = items.map(buildRow)

      // Subtotal row
      const subVolume = items.reduce((s, d) => s + convertVolume(Number(d.volume_mdc), d.density_kg_mdc, u), 0)
      const subGross = items.reduce((s, d) => s + Number(d.gross_total ?? 0), 0)
      const subDeductions = items.reduce((s, d) => s + Number(d.deductions ?? 0), 0)
      const subNet = items.reduce((s, d) => s + Number(d.net_total ?? 0), 0)

      const subtotalRow: string[] = ["", "SUBTOTAL", `${Math.round(subVolume * 10) / 10}`, "", ""]
      if (options.columns.moisture) subtotalRow.push("")
      if (options.columns.fines) subtotalRow.push("")
      subtotalRow.push(formatCurrencyPDF(subGross))
      if (options.columns.deductions)
        subtotalRow.push(subDeductions > 0 ? `-${formatCurrencyPDF(subDeductions)}` : "—")
      subtotalRow.push(formatCurrencyPDF(subNet))
      if (options.columns.plate) subtotalRow.push("")
      if (options.columns.invoice) subtotalRow.push("")
      if (options.columns.forestGuide) subtotalRow.push("")

      body.push(subtotalRow)

      autoTable(doc, {
        startY: yPos,
        head: [headers],
        body,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: {
          fillColor: [27, 67, 50],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7,
        },
        alternateRowStyles: { fillColor: [250, 250, 249] },
        didParseCell(data) {
          // Bold subtotal row
          if (data.row.index === body.length - 1) {
            data.cell.styles.fontStyle = "bold"
            data.cell.styles.fillColor = [240, 240, 238]
          }
        },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yPos = (doc as any).lastAutoTable.finalY + 8

      if (yPos > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage()
        yPos = margin
      }
    }
  } else {
    // Flat table
    const body = discharges.map(buildRow)

    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: {
        fillColor: [27, 67, 50],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [250, 250, 249] },
    })
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFontSize(7)
    doc.setTextColor(156, 163, 175)
    doc.setFont("helvetica", "normal")
    doc.text("Carvão Connect · carvaoconnect.com.br", margin, pageHeight - 8)
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" },
    )
  }

  // Download
  const dateStr = new Date().toISOString().slice(0, 10)
  doc.save(`relatorio-descargas-${dateStr}.pdf`)
}
