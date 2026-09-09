-- Business Formation Portal — initial schema
-- Run via Supabase dashboard SQL editor, or: psql $DATABASE_URL -f supabase/migrations/001_initial.sql

-- ── Orders ────────────────────────────────────────────────────────────────────

create table if not exists orders (
  id                              uuid primary key default gen_random_uuid(),
  status                          text not null default 'draft'
                                    check (status in ('draft','pending_payment','payment_confirmed','filed_with_nwra','nwra_error','complete')),
  status_token                    uuid not null default gen_random_uuid(), -- used in no-auth status page URL

  -- Step 1 — Business Formation
  business_name_choice_1          text,
  business_name_choice_2          text,
  entity_type                     text,
  business_description            text,
  business_address                text,
  formation_state                 text,       -- e.g. "NJ", "FL" — distinct from business_address state
  anticipated_start_date          date,

  -- Step 3 — Financial
  anticipated_annual_revenue      text,
  accepts_card_or_online_payments boolean,
  will_have_employees             boolean,
  personal_tax_notes              text,
  addons                          jsonb,      -- {"ein":true,"s_corp_election":false,"expedited":true,"boi_report":false}

  -- Pricing (computed server-side — never accept a client-sent amount)
  price_cents                     integer,

  -- Contact
  contact_email                   text not null,
  contact_phone                   text,

  -- Stripe
  stripe_payment_intent_id        text,
  stripe_payment_status           text,

  -- NWRA
  nwra_company_id                 text,
  nwra_order_id                   text,
  nwra_error_message              text,
  nwra_last_synced_status         text,       -- populated by status sync / webhook

  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create index if not exists orders_status_idx on orders(status);
create index if not exists orders_status_token_idx on orders(status_token);
create index if not exists orders_stripe_pi_idx on orders(stripe_payment_intent_id);

-- ── Order owners ──────────────────────────────────────────────────────────────

create table if not exists order_owners (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references orders(id) on delete cascade,
  first_name           text,
  middle_name          text,
  last_name            text,
  date_of_birth        date,
  ownership_percentage numeric(5,2),
  ssn_last4            text,           -- last 4 only, for support reference
  ssn_encrypted        text,           -- AES-256-GCM encrypted full SSN (deleted after successful NWRA call)
  citizenship_status   text,
  mailing_address      text,
  personal_address     text,
  phone                text,
  email                text,
  created_at           timestamptz not null default now()
);

create index if not exists order_owners_order_id_idx on order_owners(order_id);

-- ── Order events (audit log) ──────────────────────────────────────────────────

create table if not exists order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  event_type text not null
               check (event_type in (
                 'status_change',
                 'stripe_webhook_received',
                 'nwra_call_attempted',
                 'nwra_call_failed',
                 'email_sent'
               )),
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_id_idx on order_events(order_id);
create index if not exists order_events_type_idx on order_events(event_type);

-- ── updated_at trigger ────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at
  before update on orders
  for each row execute procedure set_updated_at();
