-- ============================================================
-- Migration: Número sequencial de descarga por organização
-- ============================================================

ALTER TABLE discharges
  ADD COLUMN IF NOT EXISTS discharge_number INTEGER;

-- Função para gerar número sequencial
CREATE OR REPLACE FUNCTION generate_discharge_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.discharge_number IS NULL THEN
    SELECT COALESCE(MAX(discharge_number), 0) + 1
    INTO NEW.discharge_number
    FROM discharges
    WHERE organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger BEFORE INSERT (roda antes do calculate_discharge_fields)
DROP TRIGGER IF EXISTS trg_discharges_generate_number ON discharges;
CREATE TRIGGER trg_discharges_generate_number
  BEFORE INSERT ON discharges
  FOR EACH ROW
  EXECUTE FUNCTION generate_discharge_number();

-- Backfill para descargas existentes
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY organization_id
    ORDER BY discharge_date, created_at
  ) AS seq
  FROM discharges
  WHERE discharge_number IS NULL
)
UPDATE discharges d
SET discharge_number = n.seq
FROM numbered n
WHERE d.id = n.id;
