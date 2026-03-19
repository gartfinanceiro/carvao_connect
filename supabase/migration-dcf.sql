-- =============================================================
-- Migration: Substituir DAP/GF por DCF
-- DCF = Documento de Controle Florestal (validade: 3 anos)
-- O usuário informa a data de emissão e o sistema calcula o vencimento
-- =============================================================

-- 1. Adicionar novas colunas
ALTER TABLE suppliers ADD COLUMN dcf_issue_date DATE;
ALTER TABLE suppliers ADD COLUMN dcf_expiry DATE;

-- 2. Migrar dados existentes (usar dap_expiry como referência se existir)
UPDATE suppliers
SET dcf_expiry = COALESCE(dap_expiry, gf_expiry),
    dcf_issue_date = COALESCE(dap_expiry, gf_expiry) - INTERVAL '3 years'
WHERE dap_expiry IS NOT NULL OR gf_expiry IS NOT NULL;

-- 3. Remover colunas antigas
ALTER TABLE suppliers DROP COLUMN dap_expiry;
ALTER TABLE suppliers DROP COLUMN gf_expiry;

-- 4. Atualizar trigger de doc_status para usar DCF
CREATE OR REPLACE FUNCTION recalculate_doc_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.dcf_expiry IS NULL THEN
    NEW.doc_status = 'pendente';
  ELSIF NEW.dcf_expiry < CURRENT_DATE THEN
    NEW.doc_status = 'irregular';
  ELSIF NEW.dcf_expiry < CURRENT_DATE + INTERVAL '30 days' THEN
    NEW.doc_status = 'pendente';
  ELSE
    NEW.doc_status = 'regular';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Recriar trigger com nova coluna
DROP TRIGGER IF EXISTS trg_suppliers_doc_status ON suppliers;
CREATE TRIGGER trg_suppliers_doc_status
  BEFORE INSERT OR UPDATE OF dcf_issue_date, dcf_expiry ON suppliers
  FOR EACH ROW EXECUTE FUNCTION recalculate_doc_status();

-- 6. Trigger para calcular dcf_expiry automaticamente a partir de dcf_issue_date
CREATE OR REPLACE FUNCTION calculate_dcf_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.dcf_issue_date IS NOT NULL THEN
    NEW.dcf_expiry = NEW.dcf_issue_date + INTERVAL '3 years';
  ELSE
    NEW.dcf_expiry = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_suppliers_dcf_expiry
  BEFORE INSERT OR UPDATE OF dcf_issue_date ON suppliers
  FOR EACH ROW EXECUTE FUNCTION calculate_dcf_expiry();

-- 7. Atualizar function de alertas de vencimento de documentos
CREATE OR REPLACE FUNCTION generate_doc_expiry_alerts()
RETURNS void AS $$
DECLARE
  sup RECORD;
BEGIN
  FOR sup IN
    SELECT s.id, s.organization_id, s.name, s.dcf_expiry
    FROM suppliers s
    WHERE s.status = 'ativo'
      AND s.dcf_expiry IS NOT NULL
      AND s.dcf_expiry <= CURRENT_DATE + INTERVAL '30 days'
      AND s.dcf_expiry >= CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.supplier_id = s.id
          AND a.type = 'vencimento_doc'
          AND a.status = 'pendente'
          AND a.title LIKE '%DCF%'
      )
  LOOP
    INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority)
    VALUES (
      sup.organization_id, sup.id, 'vencimento_doc',
      'DCF vencendo — ' || sup.name,
      'Documento de Controle Florestal vence em ' || to_char(sup.dcf_expiry, 'DD/MM/YYYY') || '. Solicitar renovação.',
      (sup.dcf_expiry - INTERVAL '7 days')::timestamptz,
      'alta'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Recalcular doc_status de todos os fornecedores existentes
UPDATE suppliers SET updated_at = now() WHERE dcf_expiry IS NOT NULL;
UPDATE suppliers SET doc_status = 'pendente' WHERE dcf_expiry IS NULL;
