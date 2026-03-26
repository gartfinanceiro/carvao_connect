-- ============================================================
-- Migration: Ciclo de vida da promessa de carga + fix due_at
-- ============================================================

-- 1. Enum para status da promessa
DO $$ BEGIN
  CREATE TYPE promised_status AS ENUM ('pendente', 'agendada', 'entregue', 'cancelada', 'adiada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Novos campos em interactions
ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS promised_status promised_status DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS promised_cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS resolved_discharge_id UUID REFERENCES discharges(id),
  ADD COLUMN IF NOT EXISTS resolved_queue_id UUID REFERENCES queue_entries(id);

COMMENT ON COLUMN interactions.promised_status IS 'Status da carga prometida: pendente, agendada, entregue, cancelada, adiada';
COMMENT ON COLUMN interactions.promised_cancel_reason IS 'Motivo do cancelamento (quando promised_status = cancelada)';
COMMENT ON COLUMN interactions.resolved_discharge_id IS 'Descarga que resolveu esta promessa (quando promised_status = entregue)';
COMMENT ON COLUMN interactions.resolved_queue_id IS 'Entrada na fila que agendou esta promessa (quando promised_status = agendada)';

-- 3. Fix: due_at de confirmacao_carga nunca no passado
CREATE OR REPLACE FUNCTION auto_create_load_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_name TEXT;
  v_due TIMESTAMPTZ;
BEGIN
  IF NEW.load_promised = true AND NEW.promised_date IS NOT NULL THEN
    SELECT name INTO v_supplier_name FROM suppliers WHERE id = NEW.supplier_id;

    v_due := GREATEST(
      (NEW.promised_date - INTERVAL '7 days')::timestamptz,
      NOW()
    );

    INSERT INTO alerts (
      organization_id, supplier_id, interaction_id,
      type, title, description, due_at, priority
    ) VALUES (
      NEW.organization_id, NEW.supplier_id, NEW.id,
      'confirmacao_carga',
      'Confirmar carga — ' || COALESCE(v_supplier_name, 'Fornecedor'),
      COALESCE(NEW.promised_volume, 1) || ' carga(s) prevista(s) para ' ||
        TO_CHAR(NEW.promised_date, 'DD/MM/YYYY'),
      v_due,
      'alta'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Auto-resolve: descarga resolve alerta + promessa
CREATE OR REPLACE FUNCTION auto_complete_load_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_interaction_id UUID;
BEGIN
  -- Resolve by interaction_id (existing behavior)
  IF NEW.interaction_id IS NOT NULL THEN
    UPDATE alerts
    SET status = 'concluido', updated_at = now()
    WHERE interaction_id = NEW.interaction_id
      AND type = 'confirmacao_carga'
      AND status IN ('pendente', 'adiado');
  END IF;

  -- Also resolve any pending confirmacao_carga for this supplier
  UPDATE alerts
  SET status = 'concluido', updated_at = now()
  WHERE supplier_id = NEW.supplier_id
    AND organization_id = NEW.organization_id
    AND type = 'confirmacao_carga'
    AND status IN ('pendente', 'adiado');

  -- Find most recent pending/scheduled promised interaction
  SELECT id INTO v_interaction_id
  FROM interactions
  WHERE supplier_id = NEW.supplier_id
    AND organization_id = NEW.organization_id
    AND load_promised = true
    AND promised_status IN ('pendente', 'agendada')
    AND promised_date IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- Mark as delivered
  IF v_interaction_id IS NOT NULL THEN
    UPDATE interactions
    SET promised_status = 'entregue',
        resolved_discharge_id = NEW.id,
        updated_at = NOW()
    WHERE id = v_interaction_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fix alertas existentes com due_at no passado
UPDATE alerts
SET due_at = GREATEST(due_at, created_at)
WHERE type = 'confirmacao_carga'
  AND status = 'pendente'
  AND due_at < created_at;
