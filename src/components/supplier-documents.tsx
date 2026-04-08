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
  Files,
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
  // Map de tipo -> quantidade de arquivos em upload simultâneo
  const [uploadingMap, setUploadingMap] = useState<Record<string, number>>({})
  const [deleteTarget, setDeleteTarget] = useState<SupplierDocument | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Estado de drag & drop
  const [dragOver, setDragOver] = useState(false)
  const [dragOverType, setDragOverType] = useState<SupplierDocumentType | null>(null)
  // Dialog para escolher categoria quando drag & drop genérico
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null)

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

  // Upload de um único arquivo (retorna true/false)
  async function uploadSingleFile(file: File, docType: SupplierDocumentType): Promise<boolean> {
    const supabase = createClient()

    const timestamp = Date.now() + Math.random().toString(36).slice(2, 6)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const filePath = `${organizationId}/${supplierId}/${docType}_${timestamp}_${safeName}`

    // 1. Upload para Storage
    const { error: uploadError } = await supabase.storage
      .from("supplier-documents")
      .upload(filePath, file)

    if (uploadError) {
      console.error("Erro no upload:", uploadError)
      return false
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
      await supabase.storage.from("supplier-documents").remove([filePath])
      return false
    }

    return true
  }

  // Upload de múltiplos arquivos para um tipo
  async function uploadFiles(files: File[], docType: SupplierDocumentType) {
    if (files.length === 0) return

    // Filtrar arquivos que excedem o limite
    const validFiles: File[] = []
    const oversized: string[] = []
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        oversized.push(file.name)
      } else {
        validFiles.push(file)
      }
    }

    if (oversized.length > 0) {
      toast.error(
        `${oversized.length} arquivo(s) excede(m) 10MB e será(ão) ignorado(s): ${oversized.join(", ")}`
      )
    }

    if (validFiles.length === 0) return

    // Atualizar estado de uploading
    setUploadingMap((prev) => ({
      ...prev,
      [docType]: (prev[docType] || 0) + validFiles.length,
    }))

    // Fazer upload em paralelo (max 3 por vez para não sobrecarregar)
    const BATCH_SIZE = 3
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < validFiles.length; i += BATCH_SIZE) {
      const batch = validFiles.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map((file) => uploadSingleFile(file, docType))
      )
      results.forEach((ok) => {
        if (ok) successCount++
        else failCount++
      })

      // Atualizar progresso: decrementar os concluídos deste batch
      setUploadingMap((prev) => ({
        ...prev,
        [docType]: Math.max(0, (prev[docType] || 0) - batch.length),
      }))
    }

    // Limpar estado final
    setUploadingMap((prev) => {
      const next = { ...prev }
      delete next[docType]
      return next
    })

    // Feedback consolidado
    if (successCount > 0 && failCount === 0) {
      toast.success(
        successCount === 1
          ? "Documento anexado com sucesso!"
          : `${successCount} documentos anexados com sucesso!`
      )
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(
        `${successCount} enviado(s), ${failCount} falharam.`
      )
    } else {
      toast.error("Erro ao enviar arquivo(s).")
    }

    fetchDocuments()
  }

  function handleAttachClick(type: SupplierDocumentType) {
    uploadTypeRef.current = type
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    const docType = uploadTypeRef.current
    if (!fileList || fileList.length === 0 || !docType) return

    // Reset input
    e.target.value = ""

    const files = Array.from(fileList)
    await uploadFiles(files, docType)
  }

  // Drag & drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    // Só desativa se saiu do card (não de um filho)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOver(false)
    setDragOverType(null)
  }

  function handleTypeDragOver(e: React.DragEvent, type: SupplierDocumentType) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverType(type)
  }

  function handleTypeDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOverType(null)
  }

  async function handleDrop(e: React.DragEvent, type?: SupplierDocumentType) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    setDragOverType(null)

    const fileList = e.dataTransfer.files
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList)

    if (type) {
      // Drop direto na categoria
      await uploadFiles(files, type)
    } else {
      // Drop genérico — abrir dialog para escolher categoria
      setPendingFiles(files)
    }
  }

  function handleSelectCategoryForPending(type: SupplierDocumentType) {
    if (!pendingFiles) return
    const files = pendingFiles
    setPendingFiles(null)
    uploadFiles(files, type)
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

  const totalUploading = Object.values(uploadingMap).reduce((a, b) => a + b, 0)

  return (
    <>
      <Card
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e)}
        className={`relative transition-colors ${
          dragOver ? "ring-2 ring-primary/50 bg-primary/5" : ""
        }`}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Documentação
            {totalUploading > 0 && (
              <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Enviando {totalUploading} arquivo(s)...
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Input de arquivo oculto — agora com multiple */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={handleFileSelected}
          />

          {/* Overlay de drag & drop */}
          {dragOver && !dragOverType && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 rounded-lg border-2 border-dashed border-primary/50 pointer-events-none">
              <div className="text-center">
                <Files className="h-10 w-10 text-primary/60 mx-auto mb-2" />
                <p className="text-sm font-medium text-primary/80">
                  Solte os arquivos sobre uma categoria
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ou solte aqui para escolher a categoria depois
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {DOCUMENT_TYPES.map((type) => {
              const typeDocs = docsByType[type] ?? []
              const hasFiles = typeDocs.length > 0
              const uploadCount = uploadingMap[type] || 0
              const isUploading = uploadCount > 0
              const isDropTarget = dragOverType === type

              return (
                <div
                  key={type}
                  className={`rounded-lg border transition-colors ${
                    isDropTarget
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : ""
                  }`}
                  onDragOver={(e) => handleTypeDragOver(e, type)}
                  onDragLeave={handleTypeDragLeave}
                  onDrop={(e) => handleDrop(e, type)}
                >
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
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          {uploadCount > 1 ? `${uploadCount}` : ""}
                        </>
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

      {/* Dialog para escolher categoria (quando drag & drop genérico) */}
      <Dialog
        open={!!pendingFiles}
        onOpenChange={(open) => !open && setPendingFiles(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha a categoria</DialogTitle>
            <DialogDescription>
              {pendingFiles?.length === 1
                ? `Para qual categoria deseja anexar "${pendingFiles[0].name}"?`
                : `Para qual categoria deseja anexar ${pendingFiles?.length} arquivo(s)?`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 max-h-[50vh] overflow-y-auto py-2">
            {DOCUMENT_TYPES.map((type) => (
              <button
                key={type}
                className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                onClick={() => handleSelectCategoryForPending(type)}
              >
                <div className="shrink-0">
                  {(docsByType[type]?.length ?? 0) > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {supplierDocumentTypeLabels[type]}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {supplierDocumentTypeDescriptions[type]}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingFiles(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
