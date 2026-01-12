-- Billing schema for Stripe subscriptions + usage tracking
CREATE TABLE billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_subscription_item_id TEXT,
  status TEXT DEFAULT 'inactive',
  trial_end TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  beta_access_granted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (board_id)
);

CREATE TABLE billing_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('feedback', 'roadmap', 'changelog', 'docs', 'support')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (board_id, service)
);

CREATE TABLE billing_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('feedback', 'roadmap', 'changelog', 'docs', 'support')),
  event_type TEXT NOT NULL,
  actor_user_id UUID NOT NULL,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  idempotency_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX billing_interactions_idempotency_idx
  ON billing_interactions (board_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX billing_interactions_board_date_idx
  ON billing_interactions (board_id, occurred_at);

CREATE TABLE billing_usage_daily (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  billable_count INTEGER NOT NULL DEFAULT 0,
  free_allowance INTEGER NOT NULL DEFAULT 50,
  stripe_reported BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_reported_at TIMESTAMP WITH TIME ZONE,
  stripe_usage_record_id TEXT,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (board_id, usage_date)
);

CREATE TABLE billing_usage_service_daily (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  service TEXT NOT NULL CHECK (service IN ('feedback', 'roadmap', 'changelog', 'docs', 'support')),
  total_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (board_id, usage_date, service)
);

CREATE TABLE billing_usage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  quantity INTEGER NOT NULL,
  stripe_usage_record_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  reported_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (board_id, usage_date)
);

CREATE TRIGGER update_billing_customers_updated_at
  BEFORE UPDATE ON billing_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_services_updated_at
  BEFORE UPDATE ON billing_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper to increment daily usage + service totals
CREATE OR REPLACE FUNCTION increment_usage_daily(
  p_board_id UUID,
  p_service TEXT,
  p_usage_date DATE,
  p_increment INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO billing_usage_daily (
    board_id,
    usage_date,
    total_count,
    billable_count,
    free_allowance,
    last_updated_at
  )
  VALUES (
    p_board_id,
    p_usage_date,
    p_increment,
    GREATEST(p_increment - 50, 0),
    50,
    NOW()
  )
  ON CONFLICT (board_id, usage_date) DO UPDATE
  SET total_count = billing_usage_daily.total_count + p_increment,
      billable_count = GREATEST(
        (billing_usage_daily.total_count + p_increment) - billing_usage_daily.free_allowance,
        0
      ),
      last_updated_at = NOW();

  INSERT INTO billing_usage_service_daily (
    board_id,
    usage_date,
    service,
    total_count
  )
  VALUES (
    p_board_id,
    p_usage_date,
    p_service,
    p_increment
  )
  ON CONFLICT (board_id, usage_date, service) DO UPDATE
  SET total_count = billing_usage_service_daily.total_count + p_increment;
END;
$$;

-- RLS
ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage_service_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_customers_admin_only ON billing_customers
  FOR ALL USING (has_board_role(board_id, ARRAY['admin']))
  WITH CHECK (has_board_role(board_id, ARRAY['admin']));

CREATE POLICY billing_services_admin_only ON billing_services
  FOR ALL USING (has_board_role(board_id, ARRAY['admin']))
  WITH CHECK (has_board_role(board_id, ARRAY['admin']));

CREATE POLICY billing_interactions_admin_select ON billing_interactions
  FOR SELECT USING (has_board_role(board_id, ARRAY['admin']));

CREATE POLICY billing_usage_daily_admin_select ON billing_usage_daily
  FOR SELECT USING (has_board_role(board_id, ARRAY['admin']));

CREATE POLICY billing_usage_service_daily_admin_select ON billing_usage_service_daily
  FOR SELECT USING (has_board_role(board_id, ARRAY['admin']));

CREATE POLICY billing_usage_reports_admin_select ON billing_usage_reports
  FOR SELECT USING (has_board_role(board_id, ARRAY['admin']));
