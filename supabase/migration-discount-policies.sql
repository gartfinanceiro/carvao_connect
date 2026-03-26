-- Migration: Política de Descontos Configurável
-- Cada organização define suas regras de desconto para umidade e impureza

-- Tabela principal de política de descontos
CREATE TABLE IF NOT EXISTS discount_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Política padrão',
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Regras de umidade (array de faixas JSON)
  -- Cada faixa: { "from": 0, "to": 7.99, "type": "none" | "excess" | "total" }
  -- "none" = sem desconto (tolerância)
  -- "excess" = desconta só o excedente acima do início da faixa no peso
  -- "total" = desconta toda a umidade no peso
  moisture_rules JSONB NOT NULL DEFAULT '[
    {"from": 0, "to": 7.99, "type": "none"},
    {"from": 8, "to": 14.99, "type": "excess"},
    {"from": 15, "to": 100, "type": "total"}
  ]'::jsonb,

  -- Regras de impureza (moinha/terra/tiço)
  -- tolerance_percent: % de tolerância (0 = sem tolerância)
  -- discount_on: "gross" (peso bruto) ou "net" (peso líquido)
  impurity_tolerance_percent NUMERIC NOT NULL DEFAULT 0,
  impurity_discount_on TEXT NOT NULL DEFAULT 'gross' CHECK (impurity_discount_on IN ('gross', 'net')),

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, is_active)
);

-- RLS
ALTER TABLE discount_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view discount policies"
  ON discount_policies FOR SELECT
  USING (organization_id = get_my_org_id());

CREATE POLICY "Org members can insert discount policies"
  ON discount_policies FOR INSERT
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "Org members can update discount policies"
  ON discount_policies FOR UPDATE
  USING (organization_id = get_my_org_id());

-- Trigger para updated_at
CREATE TRIGGER trg_discount_policies_updated_at
  BEFORE UPDATE ON discount_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Índice
CREATE INDEX IF NOT EXISTS idx_discount_policies_org
  ON discount_policies (organization_id, is_active);
