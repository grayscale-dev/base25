-- Billing schema for Stripe subscriptions + per-service pricing
CREATE TABLE billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'inactive',
  trial_end TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (board_id)
);

CREATE TABLE billing_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('feedback', 'roadmap', 'changelog')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (board_id, service)
);

CREATE TRIGGER update_billing_customers_updated_at
  BEFORE UPDATE ON billing_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_services_updated_at
  BEFORE UPDATE ON billing_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_customers_admin_only ON billing_customers
  FOR ALL USING (has_board_role(board_id, ARRAY['admin']))
  WITH CHECK (has_board_role(board_id, ARRAY['admin']));

CREATE POLICY billing_services_admin_only ON billing_services
  FOR ALL USING (has_board_role(board_id, ARRAY['admin']))
  WITH CHECK (has_board_role(board_id, ARRAY['admin']));
