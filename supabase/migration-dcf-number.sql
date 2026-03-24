-- Migration: Adicionar campo dcf_number (número da DCF) aos fornecedores
-- Permite múltiplos registros com mesmo CNPJ, diferenciados pelo número da DCF

-- 1. Adicionar coluna dcf_number
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS dcf_number TEXT;

-- 2. Remover constraint de unicidade antiga no document (se existir)
-- (Não existe constraint única no document atualmente, mas por segurança)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'suppliers_org_document_unique'
  ) THEN
    ALTER TABLE suppliers DROP CONSTRAINT suppliers_org_document_unique;
  END IF;
END $$;

-- 3. Criar constraint UNIQUE(organization_id, document, dcf_number)
-- Garante que dentro de uma mesma organização, não existam dois fornecedores
-- com o mesmo CNPJ E o mesmo número de DCF
ALTER TABLE suppliers ADD CONSTRAINT suppliers_org_document_dcf_unique 
  UNIQUE (organization_id, document, dcf_number);

-- 4. Índice para buscas por dcf_number
CREATE INDEX IF NOT EXISTS idx_suppliers_dcf_number 
  ON suppliers (organization_id, dcf_number);
