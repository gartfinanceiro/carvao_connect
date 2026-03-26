-- ============================================================
-- Migration: Dados bancários do fornecedor
-- ============================================================

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_agency TEXT,
  ADD COLUMN IF NOT EXISTS bank_account TEXT;
