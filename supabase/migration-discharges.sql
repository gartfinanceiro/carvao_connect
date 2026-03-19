-- =============================================================
-- Migration: Tabela de descargas de carvão
-- Registro de cada descarga recebida, com cálculos automáticos
-- de peso líquido, densidade, totais financeiros, e atualização
-- do fornecedor (last_price, avg_density).
-- =============================================================

-- 1. Criar tabela discharges
CREATE TABLE discharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  interaction_id UUID REFERENCES interactions(id) ON DELETE SET NULL,

  -- Dados da descarga
  discharge_date DATE NOT NULL DEFAULT CURRENT_DATE,
  volume_mdc NUMERIC(10,2) NOT NULL,
  gross_weight_kg NUMERIC(10,2),
  tare_weight_kg NUMERIC(10,2),
  net_weight_kg NUMERIC(10,2),
  density_kg_mdc NUMERIC(10,2),

  -- Qualidade
  moisture_percent NUMERIC(5,2) DEFAULT 0,
  fines_kg NUMERIC(10,2) DEFAULT 0,
  fines_percent NUMERIC(5,2) DEFAULT 0,

  -- Financeiro
  price_per_mdc NUMERIC(10,2) NOT NULL,
  gross_total NUMERIC(12,2),
  deductions NUMERIC(12,2) DEFAULT 0,
  net_total NUMERIC(12,2),

  -- Referência
  truck_plate TEXT,
  invoice_number TEXT,
  forest_guide TEXT,
  charcoal_type charcoal_type,

  -- Observações
  notes TEXT,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices
CREATE INDEX idx_discharges_org_date ON discharges(organization_id, discharge_date DESC);
CREATE INDEX idx_discharges_supplier_date ON discharges(supplier_id, discharge_date DESC);
CREATE INDEX idx_discharges_org_supplier ON discharges(organization_id, supplier_id);

-- 3. Trigger updated_at
CREATE TRIGGER trg_discharges_updated_at
  BEFORE UPDATE ON discharges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Trigger de cálculos automáticos
CREATE OR REPLACE FUNCTION calculate_discharge_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Peso líquido
  IF NEW.gross_weight_kg IS NOT NULL AND NEW.tare_weight_kg IS NOT NULL THEN
    NEW.net_weight_kg = NEW.gross_weight_kg - NEW.tare_weight_kg;
  END IF;

  -- Densidade
  IF NEW.net_weight_kg IS NOT NULL AND NEW.volume_mdc IS NOT NULL AND NEW.volume_mdc > 0 THEN
    NEW.density_kg_mdc = ROUND(NEW.net_weight_kg / NEW.volume_mdc, 2);
  END IF;

  -- Valor bruto
  NEW.gross_total = ROUND(NEW.volume_mdc * NEW.price_per_mdc, 2);

  -- Valor líquido
  NEW.net_total = ROUND(NEW.gross_total - COALESCE(NEW.deductions, 0), 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_discharges_calculate
  BEFORE INSERT OR UPDATE ON discharges
  FOR EACH ROW EXECUTE FUNCTION calculate_discharge_fields();

-- 5. Trigger para atualizar last_price do fornecedor
CREATE OR REPLACE FUNCTION update_supplier_last_price()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE suppliers
  SET last_price = (
    SELECT price_per_mdc
    FROM discharges
    WHERE supplier_id = NEW.supplier_id
    ORDER BY discharge_date DESC, created_at DESC
    LIMIT 1
  )
  WHERE id = NEW.supplier_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_discharges_update_price
  AFTER INSERT OR UPDATE ON discharges
  FOR EACH ROW EXECUTE FUNCTION update_supplier_last_price();

-- 6. Trigger para atualizar avg_density do fornecedor
CREATE OR REPLACE FUNCTION update_supplier_avg_density()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE suppliers
  SET avg_density = (
    SELECT ROUND(AVG(density_kg_mdc))
    FROM (
      SELECT density_kg_mdc
      FROM discharges
      WHERE supplier_id = NEW.supplier_id
        AND density_kg_mdc IS NOT NULL
      ORDER BY discharge_date DESC, created_at DESC
      LIMIT 10
    ) last_10
  )
  WHERE id = NEW.supplier_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_discharges_update_density
  AFTER INSERT OR UPDATE ON discharges
  FOR EACH ROW EXECUTE FUNCTION update_supplier_avg_density();

-- 7. Trigger para auto-completar alertas de confirmação de carga
CREATE OR REPLACE FUNCTION auto_complete_load_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.interaction_id IS NOT NULL THEN
    UPDATE alerts
    SET status = 'concluido', updated_at = now()
    WHERE interaction_id = NEW.interaction_id
      AND type = 'confirmacao_carga'
      AND status = 'pendente';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_discharges_complete_alert
  AFTER INSERT ON discharges
  FOR EACH ROW EXECUTE FUNCTION auto_complete_load_alert();

-- 8. RLS
ALTER TABLE discharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY discharges_select ON discharges
  FOR SELECT USING (organization_id = public.get_my_org_id());

CREATE POLICY discharges_insert ON discharges
  FOR INSERT WITH CHECK (organization_id = public.get_my_org_id());

CREATE POLICY discharges_update ON discharges
  FOR UPDATE USING (organization_id = public.get_my_org_id());

CREATE POLICY discharges_delete ON discharges
  FOR DELETE USING (organization_id = public.get_my_org_id());
