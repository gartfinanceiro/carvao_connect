-- ============================================
-- Carvão Connect - Seed Data
-- Executar APÓS a migration.sql
-- ============================================

-- Org de teste
INSERT INTO organizations (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Siderúrgica Demo');

-- ============================================
-- Trigger para criar profile automaticamente
-- quando um novo usuário se registra via auth
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, organization_id, name)
  VALUES (
    NEW.id,
    '00000000-0000-0000-0000-000000000001', -- org padrão (hardcoded para MVP)
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Dados de exemplo (após criar um usuário)
-- Descomente e ajuste o user_id para popular
-- ============================================

-- INSERT INTO suppliers (organization_id, name, document, phones, city, state, charcoal_type, avg_density, monthly_capacity, contracted_loads, last_price, dap_expiry, gf_expiry, last_contact_at) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'João Silva Carvão', '12345678901', ARRAY['31999991234'], 'Sete Lagoas', 'MG', 'eucalipto', 220, 6, 3, 85.00, '2026-12-31', '2026-06-30', now() - interval '2 days'),
--   ('00000000-0000-0000-0000-000000000001', 'Pedro Souza & Filhos', '98765432100', ARRAY['31988885678'], 'Curvelo', 'MG', 'tipi', 195, 4, 4, 78.00, '2026-08-15', '2026-03-10', now() - interval '8 days'),
--   ('00000000-0000-0000-0000-000000000001', 'ABC Carvão Vegetal LTDA', '12345678000190', ARRAY['31977774321', '31966663210'], 'Itaúna', 'MG', 'nativo', 250, 10, 5, 92.00, '2025-01-15', '2025-02-28', now() - interval '22 days'),
--   ('00000000-0000-0000-0000-000000000001', 'Maria das Cargas', '11122233344', ARRAY['38999997654'], 'Montes Claros', 'MG', 'eucalipto', 210, 8, 2, 80.00, NULL, NULL, now() - interval '5 days'),
--   ('00000000-0000-0000-0000-000000000001', 'Carvoaria Minas Gerais', '55667788000122', ARRAY['31955551234'], 'Belo Horizonte', 'MG', 'misto', 230, 12, 7, 88.00, '2027-01-01', '2026-12-01', now() - interval '1 day');
