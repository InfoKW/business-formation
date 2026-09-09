-- Business Formation Portal - initial schema
-- Run via Insforge dashboard SQL editor or the Insforge CLI:
--   insforge db push --file insforge/migrations/001_initial.sql

-- Schema isolation: all formation tables live under the `formation` schema
-- so a future virtual mailbox project can share the same Insforge project
-- without table name collisions.

CREATE SCHEMA IF NOT EXISTS formation;

-- ── Orders ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS formation.orders (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status                          text NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft','pending_payment','payment_confirmed','filed_with_nwra','nwra_error','complete')),
  status_token                    uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Step 1 - Business Formation
  business_name_choice_1          text,
  business_name_choice_2          text,
  entity_type                     text,
  business_description            text,
  business_address                text,
  formation_state                 text,
  anticipated_start_date          date,

  -- Step 3 - Financial
  anticipated_annual_revenue      text,
  accepts_card_or_online_payments boolean,
  will_have_employees             boolean,
  personal_tax_notes              text,
  addons                          jsonb,

  -- Pricing (computed server-side only)
  price_cents                     integer,

  -- Contact
  contact_email                   text NOT NULL,
  contact_phone                   text,

  -- Stripe
  stripe_payment_intent_id        text,
  stripe_payment_status           text,

  -- NWRA / Corporate Tools
  nwra_company_id                 text,
  nwra_order_id                   text,
  nwra_error_message              text,
  nwra_last_synced_status         text,

  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_status_idx       ON formation.orders(status);
CREATE INDEX IF NOT EXISTS orders_status_token_idx ON formation.orders(status_token);
CREATE INDEX IF NOT EXISTS orders_stripe_pi_idx    ON formation.orders(stripe_payment_intent_id);

-- ── Order owners ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS formation.order_owners (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES formation.orders(id) ON DELETE CASCADE,
  first_name           text,
  middle_name          text,
  last_name            text,
  date_of_birth        date,
  ownership_percentage numeric(5,2),
  ssn_last4            text,
  ssn_encrypted        text,        -- AES-256-GCM encrypted. Deleted after successful NWRA call.
  citizenship_status   text,
  mailing_address      text,
  personal_address     text,
  phone                text,
  email                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_owners_order_id_idx ON formation.order_owners(order_id);

-- ── Order events (audit log) ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS formation.order_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES formation.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL
               CHECK (event_type IN (
                 'status_change',
                 'stripe_webhook_received',
                 'nwra_call_attempted',
                 'nwra_call_failed',
                 'email_sent'
               )),
  detail     jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_events_order_id_idx ON formation.order_events(order_id);
CREATE INDEX IF NOT EXISTS order_events_type_idx     ON formation.order_events(event_type);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION formation.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_updated_at ON formation.orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON formation.orders
  FOR EACH ROW EXECUTE PROCEDURE formation.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
-- All access goes through server-side API routes using the service role key,
-- so RLS is enabled but no client-facing policies are needed.

ALTER TABLE formation.orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE formation.order_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE formation.order_events ENABLE ROW LEVEL SECURITY;
