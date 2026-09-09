// ── Order status state machine ──────────────────────────────────────────────
// Transitions are strictly one-way (draft → pending_payment → payment_confirmed
// → filed_with_nwra → complete). nwra_error is a side-track from payment_confirmed.
// Only admin actions can override status.
export type OrderStatus =
  | 'draft'
  | 'pending_payment'
  | 'payment_confirmed'
  | 'filed_with_nwra'
  | 'nwra_error'
  | 'complete'

export type EntityType =
  | 'LLC'
  | 'S-Corp'
  | 'C-Corp'
  | 'Sole Proprietorship'
  | 'Partnership'
  | 'Non-Profit'
  | 'Not sure - advise me'

export type CitizenshipStatus =
  | 'US Citizen'
  | 'Permanent Resident'
  | 'Other'

export interface OrderAddons {
  ein: boolean
  s_corp_election: boolean
  expedited: boolean
  boi_report: boolean
}

// ── Database row shapes ──────────────────────────────────────────────────────

export interface Order {
  id: string
  status: OrderStatus
  status_token: string
  business_name_choice_1: string | null
  business_name_choice_2: string | null
  entity_type: EntityType | null
  business_description: string | null
  business_address: string | null
  formation_state: string | null
  anticipated_start_date: string | null
  anticipated_annual_revenue: string | null
  accepts_card_or_online_payments: boolean | null
  will_have_employees: boolean | null
  personal_tax_notes: string | null
  addons: OrderAddons | null
  price_cents: number | null
  contact_email: string
  contact_phone: string | null
  stripe_payment_intent_id: string | null
  stripe_payment_status: string | null
  nwra_company_id: string | null
  nwra_order_id: string | null
  nwra_error_message: string | null
  nwra_last_synced_status: string | null
  created_at: string
  updated_at: string
}

export interface OrderOwner {
  id: string
  order_id: string
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  date_of_birth: string | null
  ownership_percentage: number | null
  ssn_last4: string | null
  // ssn_encrypted is never sent to the client - backend only
  citizenship_status: CitizenshipStatus | null
  mailing_address: string | null
  personal_address: string | null
  phone: string | null
  email: string | null
  created_at: string
}

export interface OrderEvent {
  id: string
  order_id: string
  event_type: 'status_change' | 'stripe_webhook_received' | 'nwra_call_attempted' | 'nwra_call_failed' | 'email_sent'
  detail: Record<string, unknown>
  created_at: string
}

// ── API request / response shapes ────────────────────────────────────────────

export interface CreateOrderRequest {
  business_name_choice_1: string
  business_name_choice_2?: string
  entity_type: EntityType
  formation_state: string
  business_description: string
  business_address: string
  anticipated_start_date: string
  contact_email: string
  contact_phone?: string
}

export interface UpdateOrderRequest {
  // Step 1 fields
  business_name_choice_1?: string
  business_name_choice_2?: string
  entity_type?: EntityType
  formation_state?: string
  business_description?: string
  business_address?: string
  anticipated_start_date?: string
  contact_email?: string
  contact_phone?: string
  // Step 3 fields
  anticipated_annual_revenue?: string
  accepts_card_or_online_payments?: boolean
  will_have_employees?: boolean
  personal_tax_notes?: string
  addons?: Partial<OrderAddons>
}

export interface CreateOwnerRequest {
  first_name: string
  middle_name?: string
  last_name: string
  date_of_birth: string
  ownership_percentage: number
  ssn_full: string   // full SSN - encrypted server-side, never stored in plain text
  citizenship_status: CitizenshipStatus
  mailing_address: string
  personal_address?: string
  phone: string
  email: string
}

// ── Form state (client-side only) ─────────────────────────────────────────────

export interface Step1Data {
  business_name_choice_1: string
  business_name_choice_2: string
  entity_type: EntityType | ''
  formation_state: string
  business_description: string
  business_address: string
  anticipated_start_date: string
  contact_email: string
  contact_phone: string
}

export interface OwnerFormData {
  first_name: string
  middle_name: string
  last_name: string
  date_of_birth: string
  ownership_percentage: string
  ssn_full: string
  citizenship_status: CitizenshipStatus | ''
  mailing_address: string
  personal_address: string
  phone: string
  email: string
}

export interface Step2Data {
  owners: OwnerFormData[]
}

export interface Step3Data {
  anticipated_annual_revenue: string
  accepts_card_or_online_payments: boolean | null
  will_have_employees: boolean | null
  personal_tax_notes: string
  addons: OrderAddons
}

export interface FormState {
  orderId: string | null
  step1: Step1Data
  step2: Step2Data
  step3: Step3Data
}

// ── Pricing ───────────────────────────────────────────────────────────────────

export interface PriceBreakdown {
  base_cents: number
  addon_ein_cents: number
  addon_s_corp_cents: number
  addon_expedited_cents: number
  addon_boi_cents: number
  total_cents: number
  line_items: { label: string; cents: number }[]
}
