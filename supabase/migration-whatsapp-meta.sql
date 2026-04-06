-- ============================================================
-- Migration: WhatsApp Z-API → Meta Cloud API
-- Suporta múltiplos números por organização
-- ============================================================

-- 1. Adaptar tabela whatsapp_connections para Meta Cloud API
-- Remover colunas Z-API e adicionar colunas Meta
ALTER TABLE whatsapp_connections
  DROP COLUMN IF EXISTS instance_id,
  DROP COLUMN IF EXISTS instance_token,
  DROP COLUMN IF EXISTS client_token;

ALTER TABLE whatsapp_connections
  ADD COLUMN IF NOT EXISTS meta_waba_id text,
  ADD COLUMN IF NOT EXISTS meta_phone_number_id text,
  ADD COLUMN IF NOT EXISTS meta_access_token text,
  ADD COLUMN IF NOT EXISTS meta_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS display_phone_number text,
  ADD COLUMN IF NOT EXISTS verified_name text,
  ADD COLUMN IF NOT EXISTS quality_rating text DEFAULT 'GREEN',
  ADD COLUMN IF NOT EXISTS messaging_limit text,
  ADD COLUMN IF NOT EXISTS label text DEFAULT 'Principal',
  ADD COLUMN IF NOT EXISTS webhook_verified boolean DEFAULT false;

-- Atualizar o tipo de status para incluir novo estado
ALTER TABLE whatsapp_connections
  DROP CONSTRAINT IF EXISTS whatsapp_connections_status_check;

ALTER TABLE whatsapp_connections
  ADD CONSTRAINT whatsapp_connections_status_check
  CHECK (status IN ('disconnected', 'connecting', 'connected', 'banned', 'rate_limited'));

-- Índice para busca rápida por phone_number_id (usado no webhook)
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_connections_phone_number_id
  ON whatsapp_connections (meta_phone_number_id)
  WHERE meta_phone_number_id IS NOT NULL;

-- Índice para buscar conexões por org (múltiplos números)
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_org_status
  ON whatsapp_connections (organization_id, status);

-- 2. Adaptar tabela whatsapp_messages para Meta
ALTER TABLE whatsapp_messages
  DROP COLUMN IF EXISTS zapi_message_id;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS meta_message_id text,
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES whatsapp_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS context_message_id text;

-- Índice para busca por meta_message_id (dedup no webhook)
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_meta_id
  ON whatsapp_messages (meta_message_id)
  WHERE meta_message_id IS NOT NULL;

-- Índice para busca por connection_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_connection
  ON whatsapp_messages (connection_id);

-- Constraint de status de mensagem
ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status IN ('received', 'sent', 'delivered', 'read', 'failed'));

-- 3. Adicionar connection_id nas conversas
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES whatsapp_connections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_connection
  ON whatsapp_conversations (connection_id);

-- 4. Tabela para templates de mensagem (para envio futuro)
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  meta_template_id text,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'pt_BR',
  category text NOT NULL DEFAULT 'UTILITY',
  status text NOT NULL DEFAULT 'PENDING',
  components jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT whatsapp_templates_category_check
    CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  CONSTRAINT whatsapp_templates_status_check
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'))
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_templates_org_isolation" ON whatsapp_templates
  FOR ALL USING (organization_id = get_my_org_id());

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_org
  ON whatsapp_templates (organization_id);

-- 5. RLS na whatsapp_connections (garantir que já existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_connections'
    AND policyname = 'whatsapp_connections_org_isolation'
  ) THEN
    CREATE POLICY whatsapp_connections_org_isolation ON whatsapp_connections
      FOR ALL USING (organization_id = get_my_org_id());
  END IF;
END $$;

-- 6. Função helper para buscar conexão por phone_number_id (usado no webhook)
CREATE OR REPLACE FUNCTION find_connection_by_phone_number_id(p_phone_number_id text)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  meta_waba_id text,
  meta_phone_number_id text,
  meta_access_token text,
  status text,
  display_phone_number text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    wc.id,
    wc.organization_id,
    wc.meta_waba_id,
    wc.meta_phone_number_id,
    wc.meta_access_token,
    wc.status::text,
    wc.display_phone_number
  FROM whatsapp_connections wc
  WHERE wc.meta_phone_number_id = p_phone_number_id
    AND wc.status = 'connected'
  LIMIT 1;
$$;

-- 7. Atualizar trigger de updated_at para novas tabelas
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger para whatsapp_templates
DROP TRIGGER IF EXISTS trg_whatsapp_templates_updated_at ON whatsapp_templates;
CREATE TRIGGER trg_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
