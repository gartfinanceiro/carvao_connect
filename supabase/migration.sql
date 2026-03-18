-- ============================================
-- Carvão Connect - Migration SQL (Dia 1)
-- Executar no Supabase SQL Editor
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE charcoal_type AS ENUM ('eucalipto', 'tipi', 'babassu', 'nativo', 'misto');
CREATE TYPE doc_status AS ENUM ('regular', 'pendente', 'irregular');
CREATE TYPE supplier_status AS ENUM ('ativo', 'inativo', 'bloqueado');
CREATE TYPE contact_type AS ENUM ('ligou', 'recebeu_ligacao', 'whatsapp', 'presencial');
CREATE TYPE contact_result AS ENUM ('atendeu', 'nao_atendeu', 'caixa_postal', 'ocupado');
CREATE TYPE next_step_type AS ENUM ('retornar_em', 'aguardar_retorno', 'nenhum');
CREATE TYPE alert_type AS ENUM ('follow_up', 'retorno_automatico', 'vencimento_doc', 'confirmacao_carga', 'inatividade');
CREATE TYPE alert_status AS ENUM ('pendente', 'concluido', 'descartado', 'adiado');
CREATE TYPE alert_priority AS ENUM ('alta', 'media', 'baixa');

-- ============================================
-- TABLES
-- ============================================

-- Organizações (multi-tenant preparado, mas 1 org por agora)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Perfis de usuário (extende auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fornecedores
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  phones TEXT[] DEFAULT '{}',
  city TEXT,
  state TEXT,
  charcoal_type charcoal_type NOT NULL DEFAULT 'eucalipto',
  avg_density NUMERIC,
  monthly_capacity INTEGER,
  contracted_loads INTEGER DEFAULT 0,
  doc_status doc_status NOT NULL DEFAULT 'pendente',
  dap_expiry DATE,
  gf_expiry DATE,
  last_price NUMERIC,
  notes TEXT,
  status supplier_status NOT NULL DEFAULT 'ativo',
  last_contact_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Interações (timeline de contatos)
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  contact_type contact_type NOT NULL,
  result contact_result NOT NULL,
  notes TEXT,
  next_step next_step_type NOT NULL DEFAULT 'nenhum',
  next_step_date TIMESTAMPTZ,
  load_promised BOOLEAN DEFAULT false,
  promised_volume INTEGER,
  promised_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alertas e follow-ups
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  interaction_id UUID REFERENCES interactions(id) ON DELETE SET NULL,
  type alert_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  status alert_status NOT NULL DEFAULT 'pendente',
  dismissed_reason TEXT,
  snoozed_until TIMESTAMPTZ,
  priority alert_priority NOT NULL DEFAULT 'media',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_suppliers_org ON suppliers(organization_id);
CREATE INDEX idx_suppliers_status ON suppliers(organization_id, status);
CREATE INDEX idx_suppliers_charcoal ON suppliers(organization_id, charcoal_type);
CREATE INDEX idx_suppliers_doc_status ON suppliers(organization_id, doc_status);
CREATE INDEX idx_suppliers_last_contact ON suppliers(organization_id, last_contact_at);

CREATE INDEX idx_interactions_supplier ON interactions(supplier_id, created_at DESC);
CREATE INDEX idx_interactions_org ON interactions(organization_id, created_at DESC);

CREATE INDEX idx_alerts_org_status ON alerts(organization_id, status, due_at);
CREATE INDEX idx_alerts_supplier ON alerts(supplier_id);
CREATE INDEX idx_alerts_due ON alerts(organization_id, due_at) WHERE status = 'pendente';

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Profiles: usuário vê só o próprio perfil e perfis da mesma org
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());

-- Organizations: membros podem ler sua org
CREATE POLICY "org_select" ON organizations FOR SELECT USING (
  id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- Suppliers: isolamento por org
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT WITH CHECK (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- Interactions: isolamento por org
CREATE POLICY "interactions_select" ON interactions FOR SELECT USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "interactions_insert" ON interactions FOR INSERT WITH CHECK (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- Alerts: isolamento por org
CREATE POLICY "alerts_select" ON alerts FOR SELECT USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "alerts_insert" ON alerts FOR INSERT WITH CHECK (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "alerts_update" ON alerts FOR UPDATE USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- ============================================
-- TRIGGERS
-- ============================================

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_interactions_updated_at BEFORE UPDATE ON interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_alerts_updated_at BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Recalcula doc_status do fornecedor baseado em DAP e GF
CREATE OR REPLACE FUNCTION recalculate_doc_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.dap_expiry IS NULL AND NEW.gf_expiry IS NULL THEN
    NEW.doc_status = 'pendente';
  ELSIF (NEW.dap_expiry IS NOT NULL AND NEW.dap_expiry < CURRENT_DATE)
     OR (NEW.gf_expiry IS NOT NULL AND NEW.gf_expiry < CURRENT_DATE) THEN
    NEW.doc_status = 'irregular';
  ELSIF (NEW.dap_expiry IS NOT NULL AND NEW.dap_expiry < CURRENT_DATE + INTERVAL '30 days')
     OR (NEW.gf_expiry IS NOT NULL AND NEW.gf_expiry < CURRENT_DATE + INTERVAL '30 days') THEN
    NEW.doc_status = 'pendente';
  ELSE
    NEW.doc_status = 'regular';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_suppliers_doc_status BEFORE INSERT OR UPDATE OF dap_expiry, gf_expiry ON suppliers
  FOR EACH ROW EXECUTE FUNCTION recalculate_doc_status();
