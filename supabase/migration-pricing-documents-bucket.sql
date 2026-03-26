-- ============================================================
-- Migration: Bucket para documentos de tabela de preços
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pricing-documents',
  'pricing-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: apenas membros da organização podem fazer upload
CREATE POLICY "Org members can upload pricing docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pricing-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations
    WHERE id = get_my_org_id()
  )
);

-- RLS: apenas membros da organização podem ler
CREATE POLICY "Org members can read pricing docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pricing-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations
    WHERE id = get_my_org_id()
  )
);
