/**
 * In-memory mock store for local development without a database.
 * Enabled when MOCK_DB=true in .env.local.
 *
 * Data lives only in memory - it resets on every server restart.
 * This is intentionally minimal: just enough to exercise the full form flow.
 */
import { randomUUID } from 'crypto'

export interface MockOrder {
  id: string
  status: string
  status_token: string
  business_name_choice_1: string | null
  business_name_choice_2: string | null
  entity_type: string | null
  formation_state: string | null
  business_description: string | null
  business_address: string | null
  anticipated_start_date: string | null
  contact_email: string
  contact_phone: string | null
  anticipated_annual_revenue: string | null
  accepts_card_or_online_payments: boolean | null
  will_have_employees: boolean | null
  personal_tax_notes: string | null
  addons: Record<string, boolean> | null
  price_cents: number | null
  stripe_payment_intent_id: string | null
  stripe_payment_status: string | null
  nwra_company_id: string | null
  nwra_order_id: string | null
  nwra_error_message: string | null
  nwra_last_synced_status: string | null
  created_at: string
  updated_at: string
}

export interface MockOwner {
  id: string
  order_id: string
  first_name: string | null
  last_name: string | null
  ownership_percentage: number | null
  ssn_last4: string | null
  email: string | null
  phone: string | null
  [key: string]: unknown
}

// Pin to globalThis so Next.js hot-module reloads don't wipe the Maps mid-session
const g = globalThis as unknown as {
  _mockOrders: Map<string, MockOrder>
  _mockOwners: Map<string, MockOwner[]>
}
if (!g._mockOrders) g._mockOrders = new Map()
if (!g._mockOwners) g._mockOwners = new Map()

const orders = g._mockOrders
const owners = g._mockOwners

export const mockStore = {
  createOrder(data: Partial<MockOrder>): MockOrder {
    const id = randomUUID()
    const order: MockOrder = {
      id,
      status: 'draft',
      status_token: randomUUID(),
      business_name_choice_1: null,
      business_name_choice_2: null,
      entity_type: null,
      formation_state: null,
      business_description: null,
      business_address: null,
      anticipated_start_date: null,
      contact_email: '',
      contact_phone: null,
      anticipated_annual_revenue: null,
      accepts_card_or_online_payments: null,
      will_have_employees: null,
      personal_tax_notes: null,
      addons: null,
      price_cents: null,
      stripe_payment_intent_id: null,
      stripe_payment_status: null,
      nwra_company_id: null,
      nwra_order_id: null,
      nwra_error_message: null,
      nwra_last_synced_status: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    }
    orders.set(id, order)
    return order
  },

  getOrder(id: string): MockOrder | undefined {
    return orders.get(id)
  },

  updateOrder(id: string, data: Partial<MockOrder>): MockOrder | undefined {
    const order = orders.get(id)
    if (!order) return undefined
    const updated = { ...order, ...data, updated_at: new Date().toISOString() }
    orders.set(id, updated)
    return updated
  },

  setOwners(orderId: string, ownerList: MockOwner[]): void {
    owners.set(orderId, ownerList)
  },

  getOwners(orderId: string): MockOwner[] {
    return owners.get(orderId) ?? []
  },

  getAllOrders(): MockOrder[] {
    return Array.from(orders.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  },
}

export const isMockMode = () => process.env.MOCK_DB === 'true'
