-- =============================================================
-- Migration Dia 2: Triggers para Interações e Alertas
-- Executar no Supabase SQL Editor
-- =============================================================

-- 1. Trigger: Atualizar last_contact_at do fornecedor
CREATE OR REPLACE FUNCTION update_supplier_last_contact()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE suppliers
  SET last_contact_at = NEW.created_at
  WHERE id = NEW.supplier_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_interaction_update_last_contact
  AFTER INSERT ON interactions
  FOR EACH ROW EXECUTE FUNCTION update_supplier_last_contact();

-- 2. Trigger: Criar alerta automático quando "não atendeu"
CREATE OR REPLACE FUNCTION auto_create_return_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.result = 'nao_atendeu' AND NEW.next_step = 'nenhum' THEN
    INSERT INTO alerts (
      organization_id, supplier_id, interaction_id,
      type, title, description, due_at, priority
    ) VALUES (
      NEW.organization_id, NEW.supplier_id, NEW.id,
      'retorno_automatico',
      'Retornar ligação — ' || (SELECT name FROM suppliers WHERE id = NEW.supplier_id),
      'Fornecedor não atendeu. Tentar novamente.',
      NEW.created_at + INTERVAL '2 hours',
      'media'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_interaction_auto_alert
  AFTER INSERT ON interactions
  FOR EACH ROW EXECUTE FUNCTION auto_create_return_alert();

-- 3. Trigger: Criar alerta de confirmação de carga
CREATE OR REPLACE FUNCTION auto_create_load_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.load_promised = true AND NEW.promised_date IS NOT NULL THEN
    INSERT INTO alerts (
      organization_id, supplier_id, interaction_id,
      type, title, description, due_at, priority
    ) VALUES (
      NEW.organization_id, NEW.supplier_id, NEW.id,
      'confirmacao_carga',
      'Confirmar carga — ' || (SELECT name FROM suppliers WHERE id = NEW.supplier_id),
      NEW.promised_volume || ' carga(s) prevista(s) para ' || to_char(NEW.promised_date, 'DD/MM/YYYY'),
      (NEW.promised_date - INTERVAL '7 days')::timestamptz,
      'alta'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_interaction_load_alert
  AFTER INSERT ON interactions
  FOR EACH ROW EXECUTE FUNCTION auto_create_load_alert();

-- 4. Trigger: Criar alerta de follow-up manual
CREATE OR REPLACE FUNCTION auto_create_followup_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.next_step = 'retornar_em' AND NEW.next_step_date IS NOT NULL THEN
    INSERT INTO alerts (
      organization_id, supplier_id, interaction_id,
      type, title, description, due_at, priority
    ) VALUES (
      NEW.organization_id, NEW.supplier_id, NEW.id,
      'follow_up',
      'Retornar contato — ' || (SELECT name FROM suppliers WHERE id = NEW.supplier_id),
      COALESCE(NEW.notes, 'Follow-up agendado'),
      NEW.next_step_date,
      'alta'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_interaction_followup_alert
  AFTER INSERT ON interactions
  FOR EACH ROW EXECUTE FUNCTION auto_create_followup_alert();
