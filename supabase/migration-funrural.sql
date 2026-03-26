-- Add FUNRURAL fields to discharges table
-- FUNRURAL = 1.5% do valor líquido, aplicável a fornecedores PF (Pessoa Física)

ALTER TABLE discharges
  ADD COLUMN IF NOT EXISTS funrural_percent NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS funrural_value NUMERIC(12,2) DEFAULT 0;

COMMENT ON COLUMN discharges.funrural_percent IS 'FUNRURAL percentage (typically 1.5% for PF suppliers)';
COMMENT ON COLUMN discharges.funrural_value IS 'FUNRURAL monetary value = net_total * funrural_percent / 100';
