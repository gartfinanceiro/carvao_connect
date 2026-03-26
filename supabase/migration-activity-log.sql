-- ============================================================
-- Migration: Activity Log para feed de atividade recente
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT get_my_org_id() REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,

  event_type TEXT NOT NULL,
  -- Valores: interaction_registered, discharge_registered,
  --          load_scheduled, load_cancelled, load_postponed,
  --          supplier_created

  supplier_id UUID REFERENCES suppliers(id),
  interaction_id UUID REFERENCES interactions(id),
  discharge_id UUID REFERENCES discharges(id),
  queue_entry_id UUID REFERENCES queue_entries(id),

  title TEXT NOT NULL,
  subtitle TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_org_created
  ON activity_log(organization_id, created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org activities"
  ON activity_log FOR SELECT
  TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY "Users can insert own org activities"
  ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_my_org_id());
