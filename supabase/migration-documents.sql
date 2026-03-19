-- =============================================================
-- Migration: Infraestrutura de documentos de fornecedores
-- Tabela supplier_documents + Storage bucket + Policies
-- =============================================================

-- 1. Criar tabela supplier_documents
CREATE TABLE supplier_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_document_type CHECK (document_type IN (
    'dcf',
    'taxa_florestal',
    'documentos_pessoais',
    'conta_deposito',
    'mapa_area',
    'certidao_imovel',
    'contrato_arrendamento',
    'inventario_area',
    'cadastro_tecnico_federal',
    'inscricao_estadual',
    'shapefile',
    'outro'
  ))
);

-- 2. Índices
CREATE INDEX idx_supplier_documents_supplier_type ON supplier_documents(supplier_id, document_type);
CREATE INDEX idx_supplier_documents_org ON supplier_documents(organization_id);

-- 3. Trigger de updated_at
CREATE TRIGGER trg_supplier_documents_updated_at
  BEFORE UPDATE ON supplier_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. RLS — isolamento por organization_id (mesmo padrão dos suppliers)
ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_documents_select ON supplier_documents
  FOR SELECT USING (organization_id = public.get_my_org_id());

CREATE POLICY supplier_documents_insert ON supplier_documents
  FOR INSERT WITH CHECK (organization_id = public.get_my_org_id());

CREATE POLICY supplier_documents_update ON supplier_documents
  FOR UPDATE USING (organization_id = public.get_my_org_id());

CREATE POLICY supplier_documents_delete ON supplier_documents
  FOR DELETE USING (organization_id = public.get_my_org_id());

-- =============================================================
-- 5. Storage Bucket: supplier-documents
-- =============================================================
-- Criar bucket privado via SQL
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-documents',
  'supplier-documents',
  false,
  10485760, -- 10MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/zip',
    'application/x-shapefile',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage Policies
-- Padrão de path: {organization_id}/{supplier_id}/{filename}

-- SELECT: usuários autenticados podem ler arquivos da sua organização
CREATE POLICY storage_supplier_docs_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'supplier-documents'
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

-- INSERT: usuários autenticados podem fazer upload na sua organização
CREATE POLICY storage_supplier_docs_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'supplier-documents'
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

-- UPDATE: usuários autenticados podem atualizar arquivos da sua organização
CREATE POLICY storage_supplier_docs_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'supplier-documents'
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

-- DELETE: usuários autenticados podem deletar arquivos da sua organização
CREATE POLICY storage_supplier_docs_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'supplier-documents'
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );
