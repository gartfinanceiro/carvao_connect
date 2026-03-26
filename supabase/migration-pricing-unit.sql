-- ============================================================
-- Migration: Suporte a pagamento por tonelada
-- ============================================================

ALTER TABLE discharges
  ADD COLUMN IF NOT EXISTS pricing_unit TEXT DEFAULT 'mdc';

COMMENT ON COLUMN discharges.pricing_unit IS 'Unidade de precificação: mdc (por metro de carvão) ou ton (por tonelada)';
