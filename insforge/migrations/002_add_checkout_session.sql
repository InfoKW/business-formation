-- Add stripe_checkout_session_id column to support Stripe Checkout (hosted payment page)
-- Run in Insforge dashboard SQL editor

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;
