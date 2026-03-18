-- =============================================================
-- Seed Demo: Dados realistas para apresentação
-- Org: Siderúrgica Demo (00000000-0000-0000-0000-000000000001)
-- =============================================================

-- Variável para facilitar referência
DO $$
DECLARE
  org_id uuid := '00000000-0000-0000-0000-000000000001';

  -- Supplier IDs (fixed para referência nos alerts)
  s1 uuid := 'a0000000-0000-0000-0000-000000000001';
  s2 uuid := 'a0000000-0000-0000-0000-000000000002';
  s3 uuid := 'a0000000-0000-0000-0000-000000000003';
  s4 uuid := 'a0000000-0000-0000-0000-000000000004';
  s5 uuid := 'a0000000-0000-0000-0000-000000000005';
  s6 uuid := 'a0000000-0000-0000-0000-000000000006';
  s7 uuid := 'a0000000-0000-0000-0000-000000000007';
  s8 uuid := 'a0000000-0000-0000-0000-000000000008';
  s9 uuid := 'a0000000-0000-0000-0000-000000000009';
  s10 uuid := 'a0000000-0000-0000-0000-000000000010';
  s11 uuid := 'a0000000-0000-0000-0000-000000000011';
  s12 uuid := 'a0000000-0000-0000-0000-000000000012';

BEGIN

-- -------------------------------------------------------
-- 1. Suppliers (12 fornecedores de MG)
-- -------------------------------------------------------
INSERT INTO suppliers (id, organization_id, name, document, phones, city, state, charcoal_type, avg_density, monthly_capacity, contracted_loads, doc_status, dap_expiry, gf_expiry, last_price, notes, status, last_contact_at)
VALUES
  -- Regular, ativo, contato recente
  (s1, org_id, 'José Carlos Pereira', '12345678901', ARRAY['(31) 99876-5432'], 'Sete Lagoas', 'MG', 'eucalipto', 230, 8, 4, 'regular', (CURRENT_DATE + INTERVAL '90 days')::date, (CURRENT_DATE + INTERVAL '120 days')::date, 85.00, 'Fornecedor confiável, entrega sempre no prazo.', 'ativo', NOW() - INTERVAL '2 days'),

  -- Regular, ativo, contato recente
  (s2, org_id, 'Fazenda São Francisco', '12345678000190', ARRAY['(38) 99123-4567', '(38) 3222-1100'], 'Montes Claros', 'MG', 'eucalipto', 245, 12, 6, 'regular', (CURRENT_DATE + INTERVAL '180 days')::date, (CURRENT_DATE + INTERVAL '200 days')::date, 92.50, 'Grande produtor. Carvão de alta qualidade.', 'ativo', NOW() - INTERVAL '1 day'),

  -- Pendente (DAP vencendo em 20 dias), contato antigo
  (s3, org_id, 'Maria Helena Oliveira', '98765432109', ARRAY['(37) 99888-7766'], 'Divinópolis', 'MG', 'nativo', 195, 4, 2, 'pendente', (CURRENT_DATE + INTERVAL '20 days')::date, (CURRENT_DATE + INTERVAL '60 days')::date, 78.00, 'Pequena produtora. Verificar renovação DAP.', 'ativo', NOW() - INTERVAL '18 days'),

  -- Regular, ativo, sem contato (inatividade)
  (s4, org_id, 'Carvoaria Boa Vista Ltda', '11222333000144', ARRAY['(33) 99555-4433'], 'Governador Valadares', 'MG', 'eucalipto', 220, 6, 3, 'regular', (CURRENT_DATE + INTERVAL '150 days')::date, (CURRENT_DATE + INTERVAL '90 days')::date, 88.00, NULL, 'ativo', NOW() - INTERVAL '20 days'),

  -- Irregular (DAP vencida), bloqueado
  (s5, org_id, 'Antônio Souza Silva', '55566677788', ARRAY['(35) 98877-6655'], 'Lavras', 'MG', 'misto', 200, 3, 0, 'irregular', (CURRENT_DATE - INTERVAL '15 days')::date, (CURRENT_DATE + INTERVAL '30 days')::date, 72.00, 'DAP vencida. Aguardando renovação para reativar.', 'bloqueado', NOW() - INTERVAL '30 days'),

  -- Regular, ativo, contato recente, bom fornecedor
  (s6, org_id, 'Florestal Norte de Minas', '99888777000155', ARRAY['(38) 99111-2233'], 'Janaúba', 'MG', 'eucalipto', 250, 15, 8, 'regular', (CURRENT_DATE + INTERVAL '240 days')::date, (CURRENT_DATE + INTERVAL '300 days')::date, 95.00, 'Maior fornecedor da região Norte. Qualidade premium.', 'ativo', NOW() - INTERVAL '3 days'),

  -- Pendente (GF vencendo em 10 dias)
  (s7, org_id, 'Pedro Henrique Costa', '44433322211', ARRAY['(31) 97777-8899'], 'Curvelo', 'MG', 'tipi', 180, 5, 2, 'pendente', (CURRENT_DATE + INTERVAL '100 days')::date, (CURRENT_DATE + INTERVAL '10 days')::date, 68.00, 'Carvão de tipi. GF prestes a vencer.', 'ativo', NOW() - INTERVAL '5 days'),

  -- Regular, ativo, sem contato há muito tempo
  (s8, org_id, 'Carvoaria Minas Verde', '22233344000166', ARRAY['(34) 99666-5544', '(34) 3333-2211'], 'Uberlândia', 'MG', 'eucalipto', 235, 10, 5, 'regular', (CURRENT_DATE + INTERVAL '200 days')::date, (CURRENT_DATE + INTERVAL '180 days')::date, 90.00, 'Bom fornecedor do Triângulo Mineiro.', 'ativo', NULL),

  -- Regular, ativo, contato recente
  (s9, org_id, 'Sebastião Alves Ferreira', '77788899900', ARRAY['(37) 99444-3322'], 'Itaúna', 'MG', 'eucalipto', 225, 6, 3, 'regular', (CURRENT_DATE + INTERVAL '60 days')::date, (CURRENT_DATE + INTERVAL '45 days')::date, 82.00, NULL, 'ativo', NOW() - INTERVAL '6 days'),

  -- Inativo
  (s10, org_id, 'Fazenda Buriti Real', '33344455000177', ARRAY['(38) 98888-1122'], 'Bocaiúva', 'MG', 'babassu', 170, 4, 0, 'regular', (CURRENT_DATE + INTERVAL '30 days')::date, (CURRENT_DATE + INTERVAL '50 days')::date, 65.00, 'Produção de babaçu. Inativo por falta de demanda.', 'inativo', NOW() - INTERVAL '60 days'),

  -- Regular, ativo, contato moderado
  (s11, org_id, 'Luciana Ferreira Santos', '88877766655', ARRAY['(33) 99222-1100'], 'Teófilo Otoni', 'MG', 'nativo', 190, 3, 1, 'regular', (CURRENT_DATE + INTERVAL '75 days')::date, (CURRENT_DATE + INTERVAL '80 days')::date, 74.00, 'Produtora de carvão nativo certificado.', 'ativo', NOW() - INTERVAL '10 days'),

  -- Pendente, ativo, contato recente
  (s12, org_id, 'Reflorestadora Vale do Jequitinhonha', '55566677000188', ARRAY['(33) 99333-4455'], 'Araçuaí', 'MG', 'eucalipto', 240, 8, 4, 'pendente', (CURRENT_DATE + INTERVAL '15 days')::date, (CURRENT_DATE + INTERVAL '25 days')::date, 87.00, 'Eucalipto reflorestado. DAP e GF vencendo em breve.', 'ativo', NOW() - INTERVAL '4 days');


-- -------------------------------------------------------
-- 2. Alerts (variados, para popular o Feed)
-- -------------------------------------------------------

-- Overdue: follow_up vencido ontem
INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority, status)
VALUES
  (org_id, s3, 'follow_up', 'Retornar ligação — Maria Helena Oliveira', 'Combinou de ligar de volta para discutir preço.', NOW() - INTERVAL '1 day', 'alta', 'pendente');

-- Overdue: inatividade de 20+ dias
INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority, status)
VALUES
  (org_id, s4, 'inatividade', 'Sem contato — Carvoaria Boa Vista Ltda', 'Último contato: há 20 dias. Retomar negociação.', NOW() - INTERVAL '2 days', 'baixa', 'pendente');

-- Today: vencimento_doc DAP
INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority, status)
VALUES
  (org_id, s3, 'vencimento_doc', 'DAP vencendo — Maria Helena Oliveira', 'DAP vence em ' || to_char((CURRENT_DATE + INTERVAL '20 days')::date, 'DD/MM/YYYY') || '. Solicitar renovação.', NOW(), 'alta', 'pendente');

-- Today: confirmacao_carga
INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority, status)
VALUES
  (org_id, s1, 'confirmacao_carga', 'Confirmar carga — José Carlos Pereira', 'Carga de 180 mdc prevista para daqui a 5 dias. Confirmar com fornecedor.', NOW(), 'media', 'pendente');

-- Today: retorno_automatico
INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority, status)
VALUES
  (org_id, s9, 'retorno_automatico', 'Retornar — Sebastião Alves Ferreira', 'Não atendeu na última tentativa. Tentar novamente.', NOW(), 'media', 'pendente');

-- Upcoming (tomorrow): follow_up
INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority, status)
VALUES
  (org_id, s6, 'follow_up', 'Acompanhar proposta — Florestal Norte de Minas', 'Aguardando resposta sobre aumento de contrato para 10 cargas/mês.', NOW() + INTERVAL '1 day', 'media', 'pendente');

-- Upcoming (2 days): vencimento_doc GF
INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority, status)
VALUES
  (org_id, s7, 'vencimento_doc', 'GF vencendo — Pedro Henrique Costa', 'Guia Florestal vence em ' || to_char((CURRENT_DATE + INTERVAL '10 days')::date, 'DD/MM/YYYY') || '. Solicitar renovação.', NOW() + INTERVAL '2 days', 'alta', 'pendente');

-- Upcoming (3 days): confirmacao_carga
INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority, status)
VALUES
  (org_id, s2, 'confirmacao_carga', 'Confirmar carga — Fazenda São Francisco', 'Carga de 240 mdc prevista. Confirmar logística.', NOW() + INTERVAL '3 days', 'media', 'pendente');

-- Upcoming: inatividade (sem contato)
INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority, status)
VALUES
  (org_id, s8, 'inatividade', 'Sem contato — Carvoaria Minas Verde', 'Nenhum contato registrado ainda.', NOW() + INTERVAL '1 day', 'baixa', 'pendente');

-- Upcoming: vencimento_doc DAP+GF
INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority, status)
VALUES
  (org_id, s12, 'vencimento_doc', 'DAP vencendo — Reflorestadora Vale do Jequitinhonha', 'DAP vence em ' || to_char((CURRENT_DATE + INTERVAL '15 days')::date, 'DD/MM/YYYY') || '. Solicitar renovação urgente.', NOW() + INTERVAL '2 days', 'alta', 'pendente');

-- Done today: concluido
INSERT INTO alerts (organization_id, supplier_id, type, title, description, due_at, priority, status)
VALUES
  (org_id, s2, 'follow_up', 'Ligar para Fazenda São Francisco', 'Confirmar disponibilidade para próxima semana.', NOW() - INTERVAL '4 hours', 'media', 'concluido'),
  (org_id, s6, 'retorno_automatico', 'Retornar — Florestal Norte de Minas', 'Retorno automático após não atender.', NOW() - INTERVAL '6 hours', 'media', 'concluido');

END $$;
