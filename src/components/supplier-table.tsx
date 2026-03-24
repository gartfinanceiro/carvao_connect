"use client"

import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  MoreHorizontal,
  MessageSquare,
  Eye,
  Pencil,
  Archive,
  ArchiveRestore,
  HelpCircle,
} from "lucide-react"
import { formatRelativeDate, getDaysFromNow } from "@/lib/utils"
import { classifySupplier, getSupplierMetrics, classificationSortOrder } from "@/lib/classification"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import type { Supplier } from "@/types/database"

interface SupplierTableProps {
  suppliers: Supplier[]
  totalCount: number
  page: number
  pageSize: number
  sortColumn: string
  sortDirection: "asc" | "desc"
  porteFilter?: string
  totalContractedAll: number
  onSort: (column: string) => void
  onPageChange: (page: number) => void
  onNewInteraction?: (supplier: Supplier) => void
  onEditSupplier?: (supplier: Supplier) => void
  onArchive?: (supplier: Supplier) => void
  onReactivate?: (supplier: Supplier) => void
}

function DocStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "regular":
      return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[11px] font-medium rounded-full px-2 py-0.5 inline-block">Regular</span>
    case "pendente":
      return <span className="bg-amber-50 text-amber-700 border border-amber-200/50 text-[11px] font-medium rounded-full px-2 py-0.5 inline-block">Pendente</span>
    case "irregular":
      return <span className="bg-red-50 text-[#FF3B30] border border-[#FF3B30]/15 text-[11px] font-medium rounded-full px-2 py-0.5 inline-block">Irregular</span>
    default:
      return null
  }
}

function getLastContactClass(daysSinceContact: number | null): { bgClass: string; textClass: string } {
  if (daysSinceContact === null) return { bgClass: "", textClass: "text-muted-foreground" }
  if (daysSinceContact <= 7) return { bgClass: "bg-green-50", textClass: "text-green-700" }
  if (daysSinceContact <= 14) return { bgClass: "bg-amber-50", textClass: "text-amber-700" }
  return { bgClass: "bg-red-50", textClass: "text-[#FF3B30]" }
}

export function SupplierTable({
  suppliers,
  totalCount,
  page,
  pageSize,
  sortColumn,
  sortDirection,
  onSort,
  onPageChange,
  onNewInteraction,
  onEditSupplier,
  onArchive,
  onReactivate,
  porteFilter,
  totalContractedAll,
}: SupplierTableProps) {
  const router = useRouter()
  const totalPages = Math.ceil(totalCount / pageSize)

  // Client-side porte filter + sort
  const displaySuppliers = (() => {
    let list = suppliers
    if (porteFilter && porteFilter !== "all") {
      list = list.filter((s) => {
        const c = classifySupplier(s.monthly_capacity, s.contracted_loads, totalContractedAll)
        return c.key === porteFilter
      })
    }
    if (sortColumn === "porte") {
      const dir = sortDirection === "asc" ? 1 : -1
      list = [...list].sort((a, b) => {
        const ca = classifySupplier(a.monthly_capacity, a.contracted_loads, totalContractedAll)
        const cb = classifySupplier(b.monthly_capacity, b.contracted_loads, totalContractedAll)
        return (classificationSortOrder[ca.key] - classificationSortOrder[cb.key]) * dir
      })
    }
    return list
  })()

  function SortableHeader({
    column,
    children,
  }: {
    column: string
    children: React.ReactNode
  }) {
    const isActive = sortColumn === column
    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-muted/50 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        onClick={() => onSort(column)}
      >
        <div className="flex items-center gap-1">
          {children}
          <ArrowUpDown
            className={`h-3 w-3 ${isActive ? "text-foreground" : "text-muted-foreground/50"}`}
          />
        </div>
      </TableHead>
    )
  }

  return (
    <div>
      <div className="rounded-2xl border border-border/50 overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/30">
              <SortableHeader column="name">Nome</SortableHeader>
              <TableHead className="hidden sm:table-cell bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">DCF</TableHead>
              <TableHead className="hidden sm:table-cell bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cidade/UF</TableHead>
              <TableHead className="hidden lg:table-cell bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Negociador</TableHead>
              <TableHead className="hidden lg:table-cell bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Densidade</TableHead>
              <TableHead className="hidden md:table-cell bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Cap.</TableHead>
              <TableHead className="hidden md:table-cell bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Contratado</TableHead>
              <TableHead className="hidden md:table-cell bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Ocioso</TableHead>
              <TableHead
                className="hidden lg:table-cell cursor-pointer select-none hover:bg-muted/50 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                onClick={() => onSort("porte")}
              >
                <div className="flex items-center gap-1">
                  Porte
                  <span title="Classificação baseada no porte (capacidade) e participação no consumo. Estratégico = grande + alta participação. Oportunidade = grande + baixa participação. Dependência = pequeno + alta participação. Complementar = pequeno + baixa participação.">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </span>
                  <ArrowUpDown
                    className={`h-3 w-3 ${sortColumn === "porte" ? "text-foreground" : "text-muted-foreground/50"}`}
                  />
                </div>
              </TableHead>
              <SortableHeader column="doc_status">Docs</SortableHeader>
              <SortableHeader column="last_contact_at">Último contato</SortableHeader>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {displaySuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                  Nenhum fornecedor encontrado.
                </TableCell>
              </TableRow>
            ) : (
              displaySuppliers.map((supplier) => {
                const idle =
                  (supplier.monthly_capacity ?? 0) - supplier.contracted_loads
                const daysSinceContact = getDaysFromNow(supplier.last_contact_at)
                const lastContactClass = getLastContactClass(daysSinceContact)
                const classification = classifySupplier(supplier.monthly_capacity, supplier.contracted_loads, totalContractedAll)
                const metrics = getSupplierMetrics(supplier.monthly_capacity, supplier.contracted_loads, totalContractedAll)

                return (
                  <TableRow
                    key={supplier.id}
                    className="group cursor-pointer hover:bg-muted/20 transition-colors border-b border-border/30 [&>td]:py-3"
                    onClick={() =>
                      router.push(`/fornecedores/${supplier.id}`)
                    }
                  >
                    <TableCell className="font-medium text-foreground">
                      {supplier.name}
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 ml-2">
                        {supplier.person_type === "pf" ? "PF" : "PJ"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm font-mono text-xs">
                      {supplier.dcf_number || "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">
                      {supplier.city && supplier.state
                        ? `${supplier.city}/${supplier.state}`
                        : supplier.city || supplier.state || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {supplier.contact_name ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {supplier.avg_density
                        ? `${supplier.avg_density} kg/mdc`
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums text-sm">
                      {supplier.monthly_capacity ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums text-sm">
                      {supplier.contracted_loads}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {idle > 0 ? (
                        <span className="font-medium text-emerald-600">
                          {idle}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{idle}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={<span className={`text-xs font-medium ${classification.color} cursor-default`} />}
                          >
                            {classification.label}
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs space-y-1">
                            <p className="font-medium text-xs">{classification.label}</p>
                            <p className="text-[11px] opacity-80">
                              Aproveitamento: {metrics.utilization}% ({supplier.contracted_loads} de {supplier.monthly_capacity ?? 0} cargas)
                            </p>
                            <p className="text-[11px] opacity-80">
                              Participação: {metrics.share}% do consumo total
                            </p>
                            {metrics.idleCapacity > 0 && (
                              <p className="text-[11px] opacity-80">
                                {metrics.idleCapacity} carga{metrics.idleCapacity > 1 ? "s" : ""} ociosa{metrics.idleCapacity > 1 ? "s" : ""}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <DocStatusBadge status={supplier.doc_status} />
                    </TableCell>
                    <TableCell>
                      {supplier.last_contact_at ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] inline-block ${lastContactClass.bgClass} ${lastContactClass.textClass}`}>
                          {formatRelativeDate(supplier.last_contact_at)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sem contato</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="bottom">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onNewInteraction?.(supplier)
                            }}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Nova interação
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/fornecedores/${supplier.id}`)
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onEditSupplier?.(supplier)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          {supplier.status !== "arquivado" && onArchive && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onArchive(supplier)
                                }}
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                Arquivar
                              </DropdownMenuItem>
                            </>
                          )}
                          {supplier.status === "arquivado" && onReactivate && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onReactivate(supplier)
                                }}
                              >
                                <ArchiveRestore className="mr-2 h-4 w-4" />
                                Reativar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Mostrando {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, totalCount)} de {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
