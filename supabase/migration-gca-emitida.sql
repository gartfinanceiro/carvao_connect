-- Add gca_emitida column to queue_entries
ALTER TABLE queue_entries
  ADD COLUMN IF NOT EXISTS gca_emitida BOOLEAN NOT NULL DEFAULT false;

-- Comment
COMMENT ON COLUMN queue_entries.gca_emitida IS 'Whether the GCA (Guia de Controle Ambiental) has been issued for this entry';
