-- ============================================================
-- Migration: Pricing by person_type (PF/PJ) + policy metadata
-- ============================================================
-- Evolui discount_policies para suportar:
-- 1. Faixas de preço diferenciadas por PF/PJ (via JSONB existente)
-- 2. Data de vigência da tabela de preços
-- 3. URL do documento-fonte (tabela de preço PDF)
-- 4. Regras adicionais (condições de pagamento, espécie, etc.)
--
-- Retrocompatível: regras sem person_type continuam funcionando.

-- 1. Novas colunas na tabela discount_policies
ALTER TABLE discount_policies
  ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS source_document_url TEXT,
  ADD COLUMN IF NOT EXISTS additional_rules JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN discount_policies.effective_date IS
  'Data de vigência da tabela de preços.';

COMMENT ON COLUMN discount_policies.source_document_url IS
  'URL do documento-fonte (ex: PDF da tabela de preços do cliente).';

COMMENT ON COLUMN discount_policies.additional_rules IS
  'Regras adicionais: {metering_tolerance_percent, payment_method, payment_deadline, species_required, third_party_payment_rule, notes}.';

-- 2. density_pricing_rules agora suporta objetos com person_type opcional:
-- Formato: [{person_type?: "pf"|"pj", min_density, max_density, price_per_mdc}]
-- Se person_type ausente, regra vale para ambos (retrocompatível).
COMMENT ON COLUMN discount_policies.density_pricing_rules IS
  'Array of density pricing rules: [{person_type?: "pf"|"pj", min_density, max_density, price_per_mdc}]. '
  'Rules without person_type apply to all suppliers. Empty = manual pricing.';
