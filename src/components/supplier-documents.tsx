"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  FileCheck,
  Upload,
  Download,
  Trash2,
  FileText,
  Image,
  File,
  CheckCircle2,
  Loader2,
  Circle,
} from "lucide-react"
import {
  supplierDocumentTypeLabels,
  supplierDocumentTypeDescriptions,
} from "@/lib/labels"
import type { SupplierDocument, SupplierDocumentType } from "@/types/database"

const DOCUMENT_TYPES = Object.keys(supplierDocumentTypeLabels) as SupplierDocumentType[]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.zip"

interface SupplierDocumentsProps {
  supplierId: string
  organizationId: string
  refreshKey?: number
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File
  if (mimeType.startsWith("image/")) return Image
  if (mimeType === "application/pdf") return FileText
  return File
}

export function SupplierDocuments({
  supplierId,
  organizationId,
  refreshKey,
}: SupplierDocumentsProps) {
  const [documents, setDocuments] = useState<SupplierDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SupplierDocument | null>(null)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTypeRef = useRef<SupplierDocumentType | null>(null)

  const fetchDocuments = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("supplier_documents")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("document_type")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erro ao buscar documentos:", error)
    } else {
      setDocuments(data ?? [])
    }
    setLoading(false)
  }, [supplierId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments, refreshKey])

  // Agrupar documentos por tipo
  const docsByType = documents.reduce<Record<string, SupplierDocument[]>>(
    (acc, doc) => {
      if (!acc[doc.document_type]) acc[doc.document_type] = []
      acc[doc.document_type].push(doc)
      return acc
    },
    {}
  )

  function handleAttachClick(type: SupplierDocumentType) {
    uploadTypeRef.current = type
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const docType = uploadTypeRef.current
    if (!file || !docType) return

    // Reset input
    e.target.value = ""

    // Validar tamanho
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo: 10MB.")
      return
    }

    setUploading(docType)
    const supabase = createClient()

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const filePath = `${organizationId}/${supplierId}/${docType}_${timestamp}_${safeName}`

    // 1. Upload para Storage
    const { error: uploadError } = await supabase.storage
      .from("supplier-documents")
      .upload(filePath, file)

    if (uploadError) {
      console.error("Erro no upload:", uploadError)
      toast.error("Erro ao enviar arquivo.")
      setUploading(null)
      return
    }

    // 2. Obter user_id
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // 3. Salvar registro no banco
    const { error: insertError } = await supabase
      .from("supplier_documents")
      .insert({
        supplier_id: supplierId,
        organization_id: organizationId,
        document_type: docType,
        original_filename: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user?.id ?? null,
      })

    if (insertError) {
      console.error("Erro ao salvar registro:", insertError)
      // Limpar arquivo órfão
      await supabase.storage.from("supplier-documents").remove([filePath])
      toast.error("Erro ao registrar documento.")
      setUploading(null)
      return
    }

    toast.success("Documento anexado com sucesso!")
    setUploading(null)
    fetchDocuments()
  }

  async function handleDownload(doc: SupplierDocument) {
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from("supplier-documents")
      .createSignedUrl(doc.file_path, 60)

    if (error || !data?.signedUrl) {
      toast.error("Erro ao gerar link de download.")
      return
    }

    window.open(data.signedUrl, "_blank")
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()

    // 1. Remover do Storage
    await supabase.storage
      .from("supplier-documents")
      .remove([deleteTarget.file_path])

    // 2. Remover registro
    const { error } = await supabase
      .from("supplier_documents")
      .delete()
      .eq("id", deleteTarget.id)

    if (error) {
      toast.error("Erro ao excluir documento.")
    } else {
      toast.success("Documento excluído.")
      fetchDocuments()
    }

    setDeleting(false)
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Documentação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Documentação
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Input de arquivo oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleFileSelected}
          />

          <div className="space-y-1">
            {DOCUMENT_TYPES.map((type) => {
              const typeDocs = docsByType[type] ?? []
              const hasFiles = typeDocs.length > 0
              const isUploading = uploading === type

              return (
                <div key={type} className="rounded-lg border">
                  {/* Cabeçalho do tipo */}
                  <div className="flex items-start gap-3 p-3">
                    <div className="mt-0.5">
                      {hasFiles ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${hasFiles ? "text-foreground" : "text-muted-foreground"}`}>
                        {supplierDocumentTypeLabels[type]}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {supplierDocumentTypeDescriptions[type]}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={isUploading}
                      onClick={() => handleAttachClick(type)}
                    >
                      {isUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Upload className="h-3.5 w-3.5 mr-1" />
                      )}
                      Anexar
                    </Button>
                  </div>

                  {/* Lista de arquivos deste tipo */}
                  {hasFiles && (
                    <div className="border-t bg-muted/30">
                      {typeDocs.map((doc) => {
                        const Icon = getFileIcon(doc.mime_type)
                        return (
                          <div
                            key={doc.id}
                            className="flex items-center gap-2 px-3 py-2 pl-11 text-sm"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate flex-1" title={doc.original_filename}>
                              {doc.original_filename}
                            </span>
                            {doc.file_size && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatFileSize(doc.file_size)}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground shrink-0">
                              {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => handleDownload(doc)}
                              title="Baixar"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(doc)}
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir documento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir &quot;{deleteTarget?.original_filename}&quot;?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
