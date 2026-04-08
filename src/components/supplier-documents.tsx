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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  X,
  Send,
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

// Arquivo pendente na área de staging
interface StagedFile {
  id: string
  file: File
  category: SupplierDocumentType | ""
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

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function SupplierDocuments({
  supplierId,
  organizationId,
  refreshKey,
}: SupplierDocumentsProps) {
  const [documents, setDocuments] = useState<SupplierDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<SupplierDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Staging area: arquivos selecionados aguardando classificação e envio
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 })

  // Drag & drop
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Adicionar arquivos à staging area
  function addFilesToStaging(files: File[]) {
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
        `${oversized.length} arquivo(s) excede(m) 10MB: ${oversized.join(", ")}`
      )
    }

    if (validFiles.length === 0) return

    const newStaged: StagedFile[] = validFiles.map((file) => ({
      id: generateId(),
      file,
      category: "",
    }))

    setStagedFiles((prev) => [...prev, ...newStaged])
  }

  // Remover arquivo da staging
  function removeStagedFile(id: string) {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  // Atualizar categoria de um arquivo
  function updateStagedCategory(id: string, category: SupplierDocumentType) {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, category } : f))
    )
  }

  // Aplicar mesma categoria a todos que estão sem categoria
  function applyToAll(category: SupplierDocumentType) {
    setStagedFiles((prev) =>
      prev.map((f) => (f.category === "" ? { ...f, category } : f))
    )
  }

  // Upload de um único arquivo
  async function uploadSingleFile(file: File, docType: SupplierDocumentType): Promise<boolean> {
    const supabase = createClient()

    const timestamp = Date.now() + Math.random().toString(36).slice(2, 6)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const filePath = `${organizationId}/${supplierId}/${docType}_${timestamp}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from("supplier-documents")
      .upload(filePath, file)

    if (uploadError) {
      console.error("Erro no upload:", uploadError)
      return false
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

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

  // Enviar todos os arquivos classificados
  async function handleSendAll() {
    const toSend = stagedFiles.filter((f) => f.category !== "")
    const unclassified = stagedFiles.filter((f) => f.category === "")

    if (toSend.length === 0) {
      toast.error("Selecione a categoria de pelo menos um arquivo.")
      return
    }

    if (unclassified.length > 0) {
      toast.error(
        `${unclassified.length} arquivo(s) sem categoria. Classifique todos ou remova os desnecessários.`
      )
      return
    }

    setUploading(true)
    setUploadProgress({ done: 0, total: toSend.length })

    const BATCH_SIZE = 3
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
      const batch = toSend.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map((f) => uploadSingleFile(f.file, f.category as SupplierDocumentType))
      )
      results.forEach((ok) => {
        if (ok) successCount++
        else failCount++
      })
      setUploadProgress({ done: i + batch.length, total: toSend.length })
    }

    setUploading(false)
    setUploadProgress({ done: 0, total: 0 })
    setStagedFiles([])

    if (successCount > 0 && failCount === 0) {
      toast.success(
        successCount === 1
          ? "Documento anexado com sucesso!"
          : `${successCount} documentos anexados com sucesso!`
      )
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(`${successCount} enviado(s), ${failCount} falharam.`)
    } else {
      toast.error("Erro ao enviar arquivo(s).")
    }

    fetchDocuments()
  }

  // Handlers de seleção de arquivo
  function handleAttachClick() {
    fileInputRef.current?.click()
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList)
    e.target.value = ""

    addFilesToStaging(files)
  }

  // Drag & drop
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    const fileList = e.dataTransfer.files
    if (!fileList || fileList.length === 0) return

    addFilesToStaging(Array.from(fileList))
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

    await supabase.storage
      .from("supplier-documents")
      .remove([deleteTarget.file_path])

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

  const hasStaged = stagedFiles.length > 0
  const allClassified = stagedFiles.every((f) => f.category !== "")
  const categoriesWithDocs = DOCUMENT_TYPES.filter((t) => (docsByType[t]?.length ?? 0) > 0)
  const categoriesWithoutDocs = DOCUMENT_TYPES.filter((t) => (docsByType[t]?.length ?? 0) === 0)

  return (
    <>
      <Card
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative transition-colors ${
          dragOver ? "ring-2 ring-primary/50 bg-primary/5" : ""
        }`}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Documentação
            </CardTitle>
            <Button
              onClick={handleAttachClick}
              disabled={uploading}
              size="sm"
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Anexar documentos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Input de arquivo oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={handleFileSelected}
          />

          {/* Overlay de drag & drop */}
          {dragOver && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 rounded-lg border-2 border-dashed border-primary/50 pointer-events-none">
              <div className="text-center">
                <Files className="h-10 w-10 text-primary/60 mx-auto mb-2" />
                <p className="text-sm font-medium text-primary/80">
                  Solte os arquivos aqui
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Você poderá classificar cada um depois
                </p>
              </div>
            </div>
          )}

          {/* Área de staging — arquivos selecionados aguardando classificação */}
          {hasStaged && (
            <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">
                  {stagedFiles.length} arquivo(s) selecionado(s)
                </p>
                {stagedFiles.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Aplicar a todos:</span>
                    <Select
                      onValueChange={(v) => {
                        if (v) applyToAll(v as SupplierDocumentType)
                      }}
                    >
                      <SelectTrigger className="h-7 w-[180px] text-xs bg-background">
                        <SelectValue placeholder="Escolher categoria">
                          {() => "Escolher categoria"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {supplierDocumentTypeLabels[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {stagedFiles.map((staged) => {
                  const Icon = getFileIcon(staged.file.type || null)
                  return (
                    <div
                      key={staged.id}
                      className="flex items-center gap-2 bg-background rounded-md border px-3 py-2"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate min-w-0 flex-1" title={staged.file.name}>
                        {staged.file.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatFileSize(staged.file.size)}
                      </span>
                      <Select
                        value={staged.category}
                        onValueChange={(v) => {
                          if (v) updateStagedCategory(staged.id, v as SupplierDocumentType)
                        }}
                      >
                        <SelectTrigger
                          className={`h-7 w-[180px] text-xs shrink-0 ${
                            staged.category === "" ? "text-muted-foreground" : ""
                          }`}
                        >
                          <SelectValue placeholder="Categoria...">
                            {(value: string) =>
                              value
                                ? supplierDocumentTypeLabels[value as SupplierDocumentType] ?? value
                                : "Categoria..."
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {supplierDocumentTypeLabels[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => removeStagedFile(staged.id)}
                        title="Remover"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>

              {/* Botões de ação */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStagedFiles([])}
                  disabled={uploading}
                >
                  Limpar tudo
                </Button>
                <div className="flex items-center gap-2">
                  {uploading && (
                    <span className="text-xs text-muted-foreground">
                      {uploadProgress.done}/{uploadProgress.total}
                    </span>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSendAll}
                    disabled={uploading || !allClassified || stagedFiles.length === 0}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Enviar {stagedFiles.length > 1 ? `${stagedFiles.length} arquivos` : "arquivo"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Dica de drag & drop quando não tem arquivos staged */}
          {!hasStaged && (
            <div className="mb-4 rounded-lg border border-dashed border-muted-foreground/25 py-6 text-center">
              <Files className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Clique em <strong>Anexar documentos</strong> ou arraste arquivos aqui
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                PDF, JPG, PNG ou ZIP — máx. 10MB por arquivo
              </p>
            </div>
          )}

          {/* Lista de documentos já enviados, agrupados por categoria */}
          <div className="space-y-1">
            {categoriesWithDocs.map((type) => {
              const typeDocs = docsByType[type] ?? []
              return (
                <div key={type} className="rounded-lg border">
                  <div className="flex items-start gap-3 p-3">
                    <div className="mt-0.5">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {supplierDocumentTypeLabels[type]}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {supplierDocumentTypeDescriptions[type]}
                      </p>
                    </div>
                  </div>
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
                </div>
              )
            })}

            {/* Categorias sem documentos — mostrar de forma compacta */}
            {categoriesWithoutDocs.length > 0 && categoriesWithDocs.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-1.5 px-1">Pendentes</p>
              </div>
            )}
            {categoriesWithoutDocs.map((type) => (
              <div key={type} className="rounded-lg border">
                <div className="flex items-start gap-3 p-3">
                  <div className="mt-0.5">
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">
                      {supplierDocumentTypeLabels[type]}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {supplierDocumentTypeDescriptions[type]}
                    </p>
                  </div>
                </div>
              </div>
            ))}
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
