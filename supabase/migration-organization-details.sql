-- ============================================================
-- Migration: Campos de detalhes da organização para ticket
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS document TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS state_registration TEXT;

COMMENT ON COLUMN organizations.document IS 'CNPJ da organização';
COMMENT ON COLUMN organizations.state_registration IS 'Inscrição Estadual (IE)';
