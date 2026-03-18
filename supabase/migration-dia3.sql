-- =============================================================
-- Migration Dia 3: Functions para alertas automáticos diários
-- Já aplicado via Supabase MCP
-- =============================================================

-- 1. Function: Gerar alertas de vencimento de documentos
CREATE OR REPLACE FUNCTION generate_doc_expiry_alerts()
RETURNS void AS $$
DECLARE
  sup RECORD;
BEGIN
  FOR sup IN
    SELECT s.id, s.organization_id, s.name, s.dap_expiry
    FROM suppliers s
    WHERE s.status = 'ativo'
      AND s.dap_expiry IS NOT NULL
      AND s.dap_expiry <= CURRENT_DATE + INTERVAL '30 days'
      AND s.dap_expiry >= CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.supplier_id = s.id
          AND a.type = 'vencimento_doc'
          AND a.status = 'pendente'
          AND a.title LIKE '%DAP%'
      )
  LOOP
    INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority)
    VALUES (
      sup.organization_id, sup.id, 'vencimento_doc',
      'DAP vencendo — ' || sup.name,
      'DAP vence em ' || to_char(sup.dap_expiry, 'DD/MM/YYYY') || '. Solicitar renovação.',
      (sup.dap_expiry - INTERVAL '7 days')::timestamptz,
      'alta'
    );
  END LOOP;

  FOR sup IN
    SELECT s.id, s.organization_id, s.name, s.gf_expiry
    FROM suppliers s
    WHERE s.status = 'ativo'
      AND s.gf_expiry IS NOT NULL
      AND s.gf_expiry <= CURRENT_DATE + INTERVAL '30 days'
      AND s.gf_expiry >= CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.supplier_id = s.id
          AND a.type = 'vencimento_doc'
          AND a.status = 'pendente'
          AND a.title LIKE '%GF%'
      )
  LOOP
    INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority)
    VALUES (
      sup.organization_id, sup.id, 'vencimento_doc',
      'GF vencendo — ' || sup.name,
      'Guia Florestal vence em ' || to_char(sup.gf_expiry, 'DD/MM/YYYY') || '. Solicitar renovação.',
      (sup.gf_expiry - INTERVAL '7 days')::timestamptz,
      'alta'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function: Gerar alertas de fornecedores inativos
CREATE OR REPLACE FUNCTION generate_inactivity_alerts()
RETURNS void AS $$
DECLARE
  sup RECORD;
BEGIN
  FOR sup IN
    SELECT s.id, s.organization_id, s.name, s.last_contact_at
    FROM suppliers s
    WHERE s.status = 'ativo'
      AND (
        s.last_contact_at IS NULL
        OR s.last_contact_at < NOW() - INTERVAL '14 days'
      )
      AND NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.supplier_id = s.id
          AND a.type = 'inatividade'
          AND a.status = 'pendente'
      )
  LOOP
    INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority)
    VALUES (
      sup.organization_id, sup.id, 'inatividade',
      'Sem contato — ' || sup.name,
      CASE
        WHEN sup.last_contact_at IS NULL THEN 'Nenhum contato registrado ainda.'
        ELSE 'Último contato: ' || to_char(sup.last_contact_at, 'DD/MM/YYYY') || ' (' ||
             EXTRACT(DAY FROM NOW() - sup.last_contact_at)::integer || ' dias atrás)'
      END,
      NOW(),
      'baixa'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: Executar ambas as functions
CREATE OR REPLACE FUNCTION refresh_daily_alerts()
RETURNS void AS $$
BEGIN
  PERFORM generate_doc_expiry_alerts();
  PERFORM generate_inactivity_alerts();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
