-- ============================================================
-- Migration: Auto-update promised_status quando queue_entry é criada/cancelada
-- ============================================================
-- Problema: quando uma carga é agendada (queue_entries.entry_type='agendamento'),
-- o status da interação correspondente não é atualizado para 'agendada'.
-- Isso faz com que o pipeline do dashboard sempre mostre 0 em "Agendadas".
--
-- Solução: trigger em queue_entries que:
--   1. Ao inserir: marca interação pendente mais recente como 'agendada'
--   2. Ao atualizar para cancelado: reverte para 'pendente' (se ainda estava agendada)
-- ============================================================

-- 1. Função que marca interação como agendada quando queue_entry é criada
--    Considera tanto 'agendamento' quanto 'fila' — ambos representam uma carga
--    materializada que deve contar como "Agendadas" no pipeline.
CREATE OR REPLACE FUNCTION auto_mark_interaction_scheduled()
RETURNS TRIGGER AS $$
DECLARE
  v_interaction_id UUID;
BEGIN
  -- Buscar interação pendente mais recente desse fornecedor com carga prometida
  SELECT id INTO v_interaction_id
  FROM interactions
  WHERE supplier_id = NEW.supplier_id
    AND organization_id = NEW.organization_id
    AND load_promised = true
    AND promised_status = 'pendente'
    AND promised_date IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- Atualizar para 'agendada' e linkar a queue_entry
  IF v_interaction_id IS NOT NULL THEN
    UPDATE interactions
    SET promised_status = 'agendada',
        resolved_queue_id = NEW.id,
        updated_at = NOW()
    WHERE id = v_interaction_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Função que reverte status quando queue_entry é cancelada
CREATE OR REPLACE FUNCTION auto_revert_interaction_on_queue_cancel()
RETURNS TRIGGER AS $$
BEGIN
  -- Se status mudou para 'cancelado', reverter interação linkada para 'pendente'
  IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
    UPDATE interactions
    SET promised_status = 'pendente',
        resolved_queue_id = NULL,
        updated_at = NOW()
    WHERE resolved_queue_id = NEW.id
      AND promised_status = 'agendada';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar triggers
DROP TRIGGER IF EXISTS trg_queue_mark_interaction_scheduled ON queue_entries;
CREATE TRIGGER trg_queue_mark_interaction_scheduled
  AFTER INSERT ON queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_interaction_scheduled();

DROP TRIGGER IF EXISTS trg_queue_revert_on_cancel ON queue_entries;
CREATE TRIGGER trg_queue_revert_on_cancel
  AFTER UPDATE OF status ON queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_revert_interaction_on_queue_cancel();

-- 4. Backfill: atualizar interações existentes que já têm queue_entry ativa
-- Busca todas as queue_entries ativas (não canceladas) e marca a interação
-- pendente mais recente de cada fornecedor como agendada.
DO $$
DECLARE
  r RECORD;
  v_interaction_id UUID;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (supplier_id, organization_id)
      id, supplier_id, organization_id, scheduled_date, created_at
    FROM queue_entries
    WHERE status IN ('aguardando', 'em_descarga')
    ORDER BY supplier_id, organization_id, created_at DESC
  LOOP
    -- Buscar interação pendente mais recente
    SELECT id INTO v_interaction_id
    FROM interactions
    WHERE supplier_id = r.supplier_id
      AND organization_id = r.organization_id
      AND load_promised = true
      AND promised_status = 'pendente'
      AND promised_date IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_interaction_id IS NOT NULL THEN
      UPDATE interactions
      SET promised_status = 'agendada',
          resolved_queue_id = r.id,
          updated_at = NOW()
      WHERE id = v_interaction_id;
    END IF;
  END LOOP;
END $$;
