# Prompts para Claude Code — Documentos Anexáveis por Fornecedor

Cada prompt abaixo é uma fase independente. Execute em ordem.

---

## FASE 1 — Storage Bucket + Tabela + Migration SQL

```
No projeto Carvão Connect (Next.js + Supabase), preciso criar a infraestrutura para anexar documentos a cada fornecedor.

### 1.1 — Criar migration SQL em `supabase/migration-documents.sql`:

Criar a tabela `supplier_documents` com:
- id (UUID, PK, default gen_random_uuid())
- supplier_id (UUID, FK → suppliers, ON DELETE CASCADE)
- organization_id (UUID, FK → organizations, ON DELETE CASCADE)
- document_type (TEXT NOT NULL) — código do tipo de documento (ver lista abaixo)
- original_filename (TEXT NOT NULL)
- file_path (TEXT NOT NULL) — caminho no Supabase Storage
- file_size (INTEGER) — tamanho em bytes
- mime_type (TEXT)
- uploaded_by (UUID, FK → auth.users)
- created_at (TIMESTAMPTZ NOT NULL DEFAULT now())
- updated_at (TIMESTAMPTZ NOT NULL DEFAULT now())

Tipos de documento (usar como valores do campo document_type):
- 'dcf' → DCF (Declaração de colheita de florestas plantadas)
- 'taxa_florestal' → Taxa florestal e expediente referente à DCF
- 'documentos_pessoais' → Documentos pessoais (RG e CPF)
- 'conta_deposito' → Conta para depósito / procuração
- 'mapa_area' → Mapa da área descrita na DCF
- 'certidao_imovel' → Certidão de registro do Imóvel
- 'contrato_arrendamento' → Contrato de arrendamento
- 'inventario_area' → Inventário da área (acima de 50 ha)
- 'cadastro_tecnico_federal' → Cadastro Técnico Federal
- 'inscricao_estadual' → Inscrição estadual do imóvel
- 'shapefile' → Shapefile
- 'outro' → Outro documento

Adicionar:
- Índice em (supplier_id, document_type)
- Índice em (organization_id)
- RLS habilitado com policies idênticas às de suppliers (isolamento por organization_id via profiles)
- Trigger de updated_at usando a function update_updated_at() já existente

### 1.2 — Configuração do Storage Bucket

Incluir no mesmo arquivo SQL, como comentário com instruções, os comandos para criar o bucket no Supabase:
- Nome do bucket: `supplier-documents`
- Público: NÃO (private)
- Tamanho máximo: 10MB por arquivo
- Tipos MIME permitidos: application/pdf, image/jpeg, image/png, application/zip, application/x-shapefile, application/octet-stream
- Policy de storage: usuários autenticados podem INSERT/SELECT/DELETE em paths que começam com seu organization_id

Gerar os comandos SQL para policies do Storage usando o padrão:
`{organization_id}/{supplier_id}/{filename}`
```

---

## FASE 2 — Tipos TypeScript + Labels

```
No projeto Carvão Connect, atualizar os tipos TypeScript e labels para suportar documentos anexáveis.

### 2.1 — Atualizar `src/types/database.ts`:

Adicionar a interface SupplierDocument:
- id: string
- supplier_id: string
- organization_id: string
- document_type: SupplierDocumentType
- original_filename: string
- file_path: string
- file_size: number | null
- mime_type: string | null
- uploaded_by: string | null
- created_at: string
- updated_at: string

Adicionar o type:
```typescript
export type SupplierDocumentType =
  | 'dcf'
  | 'taxa_florestal'
  | 'documentos_pessoais'
  | 'conta_deposito'
  | 'mapa_area'
  | 'certidao_imovel'
  | 'contrato_arrendamento'
  | 'inventario_area'
  | 'cadastro_tecnico_federal'
  | 'inscricao_estadual'
  | 'shapefile'
  | 'outro'
```

### 2.2 — Atualizar `src/lib/labels.ts`:

Adicionar o mapa de labels em português:
```typescript
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
```

Adicionar também uma descrição curta para cada tipo (usada como texto auxiliar no UI):
```typescript
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
```

Importar o type SupplierDocumentType de database.ts.
```

---

## FASE 3 — Componente de Upload e Listagem de Documentos

```
No projeto Carvão Connect, criar o componente `src/components/supplier-documents.tsx` para upload e listagem de documentos anexados a um fornecedor.

### Requisitos:

1. **Props:**
   - supplierId: string
   - organizationId: string
   - refreshKey?: number (para forçar re-fetch externo)

2. **Listagem de documentos:**
   - Buscar documentos da tabela `supplier_documents` filtrado por supplier_id
   - Agrupar visualmente por document_type
   - Exibir para cada documento: ícone do tipo de arquivo (PDF/imagem/zip), nome original do arquivo, tamanho formatado (KB/MB), data de upload
   - Botão de download (gera signed URL do Supabase Storage)
   - Botão de excluir (com confirmação via Dialog)

3. **Checklist visual de documentos sugeridos:**
   - Mostrar a lista completa dos 11 tipos de documentos como um checklist
   - Tipos que já possuem arquivo aparecem com ícone verde de check ✓
   - Tipos sem arquivo aparecem com ícone cinza e botão "Anexar"
   - Cada tipo mostra o label e a descrição curta (do supplierDocumentTypeDescriptions)

4. **Upload:**
   - Ao clicar "Anexar" em um tipo, abrir input de arquivo (aceitar PDF, JPG, PNG, ZIP)
   - Ao selecionar arquivo, fazer upload para Supabase Storage no path: `{organization_id}/{supplier_id}/{document_type}_{timestamp}_{filename}`
   - Salvar registro na tabela `supplier_documents`
   - Mostrar toast de sucesso/erro
   - Limite de 10MB por arquivo (validar no client antes de enviar)

5. **Permitir múltiplos arquivos por tipo** — o tipo 'outro' pode ter vários, mas os outros também (ex: frente e verso do RG)

6. **Design:**
   - Usar Card do shadcn/ui como container
   - Header: "Documentação" com ícone FileCheck
   - Estilo consistente com o resto do app (verde #1B4332 como cor de ação)
   - Empty state: "Nenhum documento anexado ainda"
   - Loading skeleton enquanto carrega

7. **Componentes shadcn/ui a usar:** Card, Button, Badge, Dialog (confirmação de delete), toast (sonner)
8. **Ícones lucide-react:** FileCheck, Upload, Download, Trash2, File, FileText, Image, CheckCircle2

Não esquecer de usar `createClient()` de `@/lib/supabase/client` para todas as operações.
```

---

## FASE 4 — Integrar na Página de Detalhe do Fornecedor

```
No projeto Carvão Connect, integrar o componente SupplierDocuments na página de detalhe do fornecedor.

### Arquivo: `src/components/supplier-detail.tsx`

1. Importar o componente:
   ```typescript
   import { SupplierDocuments } from "@/components/supplier-documents"
   ```

2. Adicionar o componente APÓS o card de "Informações de contato" e ANTES do card de "Timeline de interações":
   ```tsx
   <SupplierDocuments
     supplierId={supplier.id}
     organizationId={supplier.organization_id}
   />
   ```

3. O card de Documentação que já existe nos KPI cards (que mostra DCF e status documental) deve continuar existindo — ele serve como resumo rápido. O novo componente é a seção completa de gestão de documentos.

Garantir que:
- Não quebra nenhuma funcionalidade existente
- O layout continua responsivo
- `npm run build` passa sem erros
```

---

## FASE 5 — Atualizar Card de Documentação nos KPIs

```
No projeto Carvão Connect, atualizar o card de "Documentação" nos KPI cards do supplier-detail.tsx para mostrar um contador de documentos anexados.

### Mudanças no card existente de Documentação (o terceiro KPI card com ícone FileCheck):

1. Manter o DocStatusBadge e as datas da DCF como estão
2. Adicionar abaixo das datas da DCF um contador simples:
   - Buscar o COUNT de documentos em `supplier_documents` para este fornecedor
   - Exibir: "X de 11 documentos anexados" (ou "X documentos" se preferir manter simples)
   - Se 11/11: badge verde "Completo"
   - Se < 11: texto em cinza muted

3. Usar um state local com useEffect para buscar a contagem ao montar o componente
4. O fetch deve ser leve — apenas count, não os dados completos

Garantir que `npm run build` passa sem erros.
```

---

## Notas de implementação para o Claude Code:

- **Stack:** Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui + Supabase
- **Linguagem da UI:** Português brasileiro em tudo (labels, placeholders, mensagens, datas DD/MM/YYYY)
- **Cor primária:** #1B4332 (verde escuro) para botões de ação
- **Supabase client:** Usar `createClient()` de `@/lib/supabase/client` (browser) — não server
- **Toasts:** Usar `toast` de `sonner` para feedback
- **Zero erros TypeScript** — `npx tsc --noEmit` deve passar limpo em cada fase
- **Mudanças cirúrgicas** — não reescrever componentes inteiros, apenas adicionar/editar o necessário
- **RLS:** Todas as novas tabelas devem ter RLS com isolamento por organization_id
