-- ============================================================
-- Migration: Density-based pricing + moisture/impurity weight deduction
-- ============================================================
-- Lógica correta da siderúrgica:
-- 1. Peso líquido = bruto - tara
-- 2. Desconto umidade no peso (conforme regras da organização)
-- 3. Desconto impurezas no peso
-- 4. Peso ajustado = peso líquido - umidade_kg - impurezas_kg
-- 5. Densidade = peso ajustado / volume_mdc

-- 1. Add density_pricing_rules to discount_policies
-- Format: JSONB array of { min_density, max_density, price_per_mdc }
ALTER TABLE discount_policies
  ADD COLUMN IF NOT EXISTS density_pricing_rules JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN discount_policies.density_pricing_rules IS
  'Array of density pricing rules: [{min_density, max_density, price_per_mdc}]. Empty = manual pricing.';

-- 2. Update calculate_discharge_fields() trigger
-- Now subtracts BOTH moisture AND impurities from net_weight before calculating density.
-- The trigger reads the active discount_policy of the organization to determine moisture rules.
CREATE OR REPLACE FUNCTION calculate_discharge_fields()
RETURNS TRIGGER AS $$
DECLARE
  moisture_deduction_kg NUMERIC := 0;
  adjusted_weight NUMERIC;
  v_moisture_rules JSONB;
  v_rule RECORD;
  v_deduction_pct NUMERIC;
BEGIN
  -- Calculate net weight from gross - tare
  IF NEW.gross_weight_kg IS NOT NULL AND NEW.tare_weight_kg IS NOT NULL THEN
    NEW.net_weight_kg := NEW.gross_weight_kg - NEW.tare_weight_kg;
  END IF;

  -- Calculate moisture weight deduction using organization's discount policy
  IF NEW.net_weight_kg IS NOT NULL AND NEW.net_weight_kg > 0 AND COALESCE(NEW.moisture_percent, 0) > 0 THEN
    -- Fetch active moisture_rules for this organization
    SELECT dp.moisture_rules INTO v_moisture_rules
    FROM discount_policies dp
    WHERE dp.organization_id = NEW.organization_id
      AND dp.is_active = true
    LIMIT 1;

    IF v_moisture_rules IS NOT NULL AND jsonb_array_length(v_moisture_rules) > 0 THEN
      -- Find matching moisture rule
      FOR v_rule IN
        SELECT
          (elem->>'from')::numeric AS rule_from,
          (elem->>'to')::numeric AS rule_to,
          elem->>'type' AS rule_type
        FROM jsonb_array_elements(v_moisture_rules) AS elem
        ORDER BY (elem->>'from')::numeric
      LOOP
        IF NEW.moisture_percent >= v_rule.rule_from AND NEW.moisture_percent <= v_rule.rule_to THEN
          IF v_rule.rule_type = 'excess' THEN
            v_deduction_pct := NEW.moisture_percent - v_rule.rule_from;
          ELSIF v_rule.rule_type = 'total' THEN
            v_deduction_pct := NEW.moisture_percent;
          ELSE
            v_deduction_pct := 0; -- 'none' = tolerance
          END IF;

          IF v_deduction_pct > 0 THEN
            moisture_deduction_kg := ROUND((v_deduction_pct / 100.0) * NEW.net_weight_kg, 2);
          END IF;
          EXIT; -- found matching rule, stop
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Calculate density using ADJUSTED weight (net - moisture - impurities)
  IF NEW.net_weight_kg IS NOT NULL AND NEW.net_weight_kg > 0 AND NEW.volume_mdc IS NOT NULL AND NEW.volume_mdc > 0 THEN
    adjusted_weight := NEW.net_weight_kg - moisture_deduction_kg - COALESCE(NEW.fines_kg, 0);
    IF adjusted_weight > 0 THEN
      NEW.density_kg_mdc := ROUND(adjusted_weight / NEW.volume_mdc, 2);
    ELSE
      -- Fallback: use net weight only (no deductions)
      NEW.density_kg_mdc := ROUND(NEW.net_weight_kg / NEW.volume_mdc, 2);
    END IF;
  END IF;

  -- Calculate fines percent (based on net weight)
  IF NEW.fines_kg IS NOT NULL AND NEW.net_weight_kg IS NOT NULL AND NEW.net_weight_kg > 0 THEN
    NEW.fines_percent := ROUND((NEW.fines_kg / NEW.net_weight_kg) * 100, 2);
  END IF;

  -- Calculate gross total
  IF NEW.volume_mdc IS NOT NULL AND NEW.price_per_mdc IS NOT NULL THEN
    NEW.gross_total := ROUND(NEW.volume_mdc * NEW.price_per_mdc, 2);
  END IF;

  -- Calculate net total
  IF NEW.gross_total IS NOT NULL THEN
    NEW.net_total := ROUND(NEW.gross_total - COALESCE(NEW.deductions, 0), 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
