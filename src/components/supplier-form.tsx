"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { UF_OPTIONS } from "@/lib/labels"
import { validateDocument, validatePhone } from "@/lib/utils"
import type { Supplier, PersonType } from "@/types/database"

interface SupplierFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier?: Supplier | null
  onSuccess: () => void
}

interface FormData {
  name: string
  document: string
  person_type: PersonType
  contact_name: string
  phones: string[]
  city: string
  state: string
  avg_density: string
  monthly_capacity: string
  contracted_loads: string
  last_price: string
  dcf_number: string
  dcf_issue_date: string
  notes: string
}

function getInitialFormData(supplier?: Supplier | null): FormData {
  return {
    name: supplier?.name ?? "",
    document: supplier?.document ?? "",
    person_type: supplier?.person_type ?? "pj",
    contact_name: supplier?.contact_name ?? "",
    phones: supplier?.phones?.length ? supplier.phones : [""],
    city: supplier?.city ?? "",
    state: supplier?.state ?? "",
    avg_density: supplier?.avg_density?.toString() ?? "",
    monthly_capacity: supplier?.monthly_capacity?.toString() ?? "",
    contracted_loads: supplier?.contracted_loads?.toString() ?? "0",
    last_price: supplier?.last_price?.toString() ?? "",
    dcf_number: supplier?.dcf_number ?? "",
    dcf_issue_date: supplier?.dcf_issue_date ?? "",
    notes: supplier?.notes ?? "",
  }
}

export function SupplierForm({
  open,
  onOpenChange,
  supplier,
  onSuccess,
}: SupplierFormProps) {
  const isEdit = !!supplier
  const [form, setForm] = useState<FormData>(getInitialFormData(supplier))
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [loading, setLoading] = useState(false)

  // Reset form when dialog opens with new data
  function handleOpenChange(open: boolean) {
    if (open) {
      setForm(getInitialFormData(supplier))
      setErrors({})
    }
    onOpenChange(open)
  }

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function addPhone() {
    setForm((prev) => ({ ...prev, phones: [...prev.phones, ""] }))
  }

  function updatePhone(index: number, value: string) {
    setForm((prev) => ({
      ...prev,
      phones: prev.phones.map((p, i) => (i === index ? value : p)),
    }))
  }

  function removePhone(index: number) {
    if (form.phones.length <= 1) return
    setForm((prev) => ({
      ...prev,
      phones: prev.phones.filter((_, i) => i !== index),
    }))
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!form.name.trim()) newErrors.name = "Nome é obrigatório"
    if (!form.document.trim()) {
      newErrors.document = "CPF/CNPJ é obrigatório"
    } else if (!validateDocument(form.document)) {
      newErrors.document = "CPF (11 dígitos) ou CNPJ (14 dígitos)"
    }

    const validPhones = form.phones.filter((p) => p.trim())
    if (validPhones.length === 0) {
      newErrors.phones = "Pelo menos um telefone é obrigatório"
    } else {
      for (const phone of validPhones) {
        if (!validatePhone(phone)) {
          newErrors.phones = "Telefone deve ter pelo menos 10 dígitos"
          break
        }
      }
    }

    if (!form.dcf_number.trim()) newErrors.dcf_number = "Número da DCF é obrigatório"

    if (!form.city.trim()) newErrors.city = "Cidade é obrigatória"
    if (!form.state) newErrors.state = "UF é obrigatória"

    if (!form.avg_density) {
      newErrors.avg_density = "Densidade é obrigatória"
    } else {
      const density = Number(form.avg_density)
      if (density < 100 || density > 400)
        newErrors.avg_density = "Entre 100 e 400 kg/mdc"
    }

    if (!form.monthly_capacity) {
      newErrors.monthly_capacity = "Capacidade é obrigatória"
    } else if (Number(form.monthly_capacity) < 1) {
      newErrors.monthly_capacity = "Mínimo 1 carga"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    const supabase = createClient()

    const phones = form.phones.filter((p) => p.trim())

    const payload = {
      name: form.name.trim(),
      document: form.document.replace(/\D/g, ""),
      person_type: form.person_type,
      contact_name: form.contact_name.trim() || null,
      phones,
      city: form.city.trim(),
      state: form.state,
      avg_density: Number(form.avg_density),
      monthly_capacity: Number(form.monthly_capacity),
      contracted_loads: Number(form.contracted_loads) || 0,
      last_price: form.last_price ? Number(form.last_price) : null,
      dcf_number: form.dcf_number.trim(),
      dcf_issue_date: form.dcf_issue_date || null,
      notes: form.notes.trim() || null,
    }

    if (isEdit && supplier) {
      const { error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", supplier.id)

      if (error) {
        toast.error("Erro ao atualizar fornecedor.")
        setLoading(false)
        return
      }
      toast.success("Fornecedor atualizado com sucesso!")
    } else {
      const { error } = await supabase.from("suppliers").insert(payload)

      if (error) {
        if (error.code === "23505") {
          toast.error("Já existe um fornecedor com este CPF/CNPJ e número de DCF.")
        } else {
          toast.error("Erro ao criar fornecedor.")
        }
        setLoading(false)
        return
      }
      toast.success("Fornecedor criado com sucesso!")
    }

    setLoading(false)
    onOpenChange(false)
    onSuccess()
  }

  // Compute doc_status preview
  // Calcula vencimento da DCF (emissão + 3 anos)
  function getDcfExpiry(): Date | null {
    if (!form.dcf_issue_date) return null
    const issue = new Date(form.dcf_issue_date)
    const expiry = new Date(issue)
    expiry.setFullYear(expiry.getFullYear() + 3)
    return expiry
  }

  function getDocStatusPreview(): string {
    const expiry = getDcfExpiry()
    if (!expiry) return "pendente"
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    if (expiry < now) return "irregular"
    if (expiry < in30Days) return "pendente"
    return "regular"
  }

  function formatDcfExpiry(): string {
    const expiry = getDcfExpiry()
    if (!expiry) return ""
    return expiry.toLocaleDateString("pt-BR")
  }

  const docPreview = getDocStatusPreview()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar fornecedor" : "Novo fornecedor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Column 1 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome / Razão Social *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Nome do fornecedor"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="document">{form.person_type === "pf" ? "CPF *" : "CNPJ *"}</Label>
                <Input
                  id="document"
                  value={form.document}
                  onChange={(e) => updateField("document", e.target.value)}
                  placeholder="Apenas números"
                />
                {errors.document && (
                  <p className="text-xs text-destructive">{errors.document}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dcf_number">Número da DCF *</Label>
                <Input
                  id="dcf_number"
                  value={form.dcf_number}
                  onChange={(e) => updateField("dcf_number", e.target.value)}
                  placeholder="Ex: DCF-001234/2024"
                />
                {errors.dcf_number && (
                  <p className="text-xs text-destructive">{errors.dcf_number}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>PF / PJ</Label>
                <div className="flex gap-2">
                  {(["pf", "pj"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        form.person_type === type
                          ? "bg-[#1B4332] text-white border-[#1B4332]"
                          : "bg-white text-foreground border-[#E5E5E5] hover:border-[#999]"
                      }`}
                      onClick={() => updateField("person_type", type)}
                    >
                      {type === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_name">Negociador</Label>
                <Input
                  id="contact_name"
                  value={form.contact_name}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                  placeholder="Nome da pessoa de contato"
                />
              </div>

              <div className="space-y-2">
                <Label>Telefone(s) *</Label>
                {form.phones.map((phone, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={phone}
                      onChange={(e) => updatePhone(i, e.target.value)}
                      placeholder="(31) 99999-9999"
                    />
                    {form.phones.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePhone(i)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPhone}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Adicionar telefone
                </Button>
                {errors.phones && (
                  <p className="text-xs text-destructive">{errors.phones}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Cidade *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="Ex: Sete Lagoas"
                />
                {errors.city && (
                  <p className="text-xs text-destructive">{errors.city}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>UF *</Label>
                <Select
                  value={form.state}
                  onValueChange={(v) => updateField("state", v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a UF">
                      {(value: string) => value || "Selecione a UF"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.state && (
                  <p className="text-xs text-destructive">{errors.state}</p>
                )}
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="avg_density">Densidade média (kg/mdc) *</Label>
                <Input
                  id="avg_density"
                  type="number"
                  value={form.avg_density}
                  onChange={(e) => updateField("avg_density", e.target.value)}
                  placeholder="ex: 220"
                  min={100}
                  max={400}
                />
                {errors.avg_density && (
                  <p className="text-xs text-destructive">
                    {errors.avg_density}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthly_capacity">
                  Capacidade mensal (cargas) *
                </Label>
                <Input
                  id="monthly_capacity"
                  type="number"
                  value={form.monthly_capacity}
                  onChange={(e) =>
                    updateField("monthly_capacity", e.target.value)
                  }
                  placeholder="ex: 6"
                  min={1}
                />
                {errors.monthly_capacity && (
                  <p className="text-xs text-destructive">
                    {errors.monthly_capacity}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contracted_loads">Cargas contratadas</Label>
                <Input
                  id="contracted_loads"
                  type="number"
                  value={form.contracted_loads}
                  onChange={(e) =>
                    updateField("contracted_loads", e.target.value)
                  }
                  min={0}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_price">Preço última compra (R$/mdc)</Label>
                <Input
                  id="last_price"
                  type="number"
                  value={form.last_price}
                  onChange={(e) => updateField("last_price", e.target.value)}
                  placeholder="ex: 85.00"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Documentation section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Documentação
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="dcf_issue_date">Data de emissão da DCF</Label>
                <Input
                  id="dcf_issue_date"
                  type="date"
                  value={form.dcf_issue_date}
                  onChange={(e) => updateField("dcf_issue_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento (3 anos)</Label>
                <p className="text-sm h-9 flex items-center font-medium">
                  {formatDcfExpiry() || "—"}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Status documental</Label>
                <div>
                  {docPreview === "regular" && (
                    <span className="text-xs text-emerald-600 font-medium">Regular</span>
                  )}
                  {docPreview === "pendente" && (
                    <span className="text-xs text-amber-600 font-medium">Pendente</span>
                  )}
                  {docPreview === "irregular" && (
                    <span className="text-xs text-red-500 font-medium">Irregular</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Observações gerais sobre o fornecedor..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#1B4332] hover:bg-[#2D6A4F]"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Salvar fornecedor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
