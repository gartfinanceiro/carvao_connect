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
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"
import { charcoalTypeLabels } from "@/lib/labels"
import { formatRelativeDate, getDaysFromNow } from "@/lib/utils"
import type { Supplier } from "@/types/database"

interface SupplierTableProps {
  suppliers: Supplier[]
  totalCount: number
  page: number
  pageSize: number
  sortColumn: string
  sortDirection: "asc" | "desc"
  onSort: (column: string) => void
  onPageChange: (page: number) => void
  onNewInteraction?: (supplier: Supplier) => void
  onEditSupplier?: (supplier: Supplier) => void
}

function DocStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "regular":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Regular</Badge>
    case "pendente":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendente</Badge>
    case "irregular":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Irregular</Badge>
    default:
      return null
  }
}

function getContactColorClass(daysSinceContact: number | null): string {
  if (daysSinceContact === null) return "text-muted-foreground"
  if (daysSinceContact > 14) return "text-red-600 font-medium"
  if (daysSinceContact > 7) return "text-amber-600 font-medium"
  return "text-green-600 font-medium"
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
}: SupplierTableProps) {
  const router = useRouter()
  const totalPages = Math.ceil(totalCount / pageSize)

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
        className="cursor-pointer select-none hover:bg-muted/50"
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
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader column="name">Nome</SortableHeader>
              <TableHead className="hidden sm:table-cell">Cidade/UF</TableHead>
              <SortableHeader column="charcoal_type">Tipo</SortableHeader>
              <TableHead className="hidden lg:table-cell">Densidade</TableHead>
              <TableHead className="hidden md:table-cell">Cap.</TableHead>
              <TableHead className="hidden md:table-cell">Contratado</TableHead>
              <TableHead className="hidden md:table-cell">Ocioso</TableHead>
              <SortableHeader column="doc_status">Docs</SortableHeader>
              <SortableHeader column="last_contact_at">Último contato</SortableHeader>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                  Nenhum fornecedor encontrado.
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => {
                const idle =
                  (supplier.monthly_capacity ?? 0) - supplier.contracted_loads
                const daysSinceContact = getDaysFromNow(supplier.last_contact_at)
                const contactColorClass = getContactColorClass(daysSinceContact)

                return (
                  <TableRow
                    key={supplier.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      router.push(`/fornecedores/${supplier.id}`)
                    }
                  >
                    <TableCell className="font-medium">
                      {supplier.name}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {supplier.city && supplier.state
                        ? `${supplier.city}/${supplier.state}`
                        : supplier.city || supplier.state || "—"}
                    </TableCell>
                    <TableCell>
                      {charcoalTypeLabels[supplier.charcoal_type]}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {supplier.avg_density
                        ? `${supplier.avg_density} kg/mdc`
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {supplier.monthly_capacity ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {supplier.contracted_loads}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {idle > 0 ? (
                        <span className="font-bold text-[#1B4332]">
                          {idle}
                        </span>
                      ) : (
                        <span>{idle}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DocStatusBadge status={supplier.doc_status} />
                    </TableCell>
                    <TableCell>
                      <span className={contactColorClass}>
                        {supplier.last_contact_at
                          ? formatRelativeDate(supplier.last_contact_at)
                          : "Sem contato"}
                      </span>
                    </TableCell>
                    <TableCell>
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
                        </DropdownMenuContent>
                      </DropdownMenu>
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
          <p className="text-sm text-muted-foreground">
            Mostrando {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, totalCount)} de {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
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
