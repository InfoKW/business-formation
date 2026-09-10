/**
 * Northwest Registered Agent / Corporate Tools API integration.
 *
 * Authentication: JWT with HS256
 *   Header:  { alg: 'HS256', access_key: NWRA_ACCESS_KEY }
 *   Payload: { path: '/companies', content: sha256(queryString + requestBody) }
 *   Signed with: NWRA_SECRET_KEY
 *
 * Formation filing flow (3 steps):
 *   1. POST /companies           → create company record, get company_id
 *   2. POST /shopping-cart       → add formation filing product to cart
 *   3. POST /shopping-cart/checkout → place order (charges KelliWorks' NWRA account)
 *      Returns invoice_ids — actual confirmation via paid-invoice callback
 *
 * ── OPEN ITEMS ───────────────────────────────────────────────────────────────
 *  1. product_id — UUID for the formation filing product. Fetch from
 *     GET /filing-products filtered by entity_type + jurisdiction, OR use a
 *     fixed UUID per product type if NWRA assigns them as a wholesale partner.
 *     Set NWRA_FORMATION_PRODUCT_ID env var once confirmed.
 *  2. product_option_id — UUID for standard vs expedited filing method.
 *     Check GET /filing-methods. Set NWRA_STANDARD_OPTION_ID and
 *     NWRA_EXPEDITED_OPTION_ID env vars once confirmed.
 *  3. payment_token — KelliWorks' saved payment method UUID on NWRA's account.
 *     Check GET /payment-methods. Set NWRA_PAYMENT_TOKEN env var.
 *  4. form_data schema — check GET /filing-methods/schema for required fields
 *     per filing type (may need business address, owner info, etc.)
 *  5. paid-invoice callback — implement /api/webhooks/nwra to handle async
 *     order confirmation from NWRA (see Callbacks section in their docs).
 *  6. Test in NWRA sandbox before going live.
 *
 * ── SSN handling ────────────────────────────────────────────────────────────
 *  Full SSNs are decrypted in nwra-submit.ts, passed here in memory, and are
 *  NOT logged, not written to order_events, not cached anywhere.
 *  On successful NWRA submission the ssn_encrypted column is deleted.
 */

import { SignJWT } from 'jose'
import { createHash } from 'crypto'
import type { Order, OrderOwner } from '@/types'

const NWRA_BASE_URL = 'https://api.corporatetools.com'

// ── Lookup tables ─────────────────────────────────────────────────────────────

/** Map KelliWorks entity type codes → NWRA full entity type strings */
const ENTITY_TYPE_MAP: Record<string, string> = {
  LLC:                  'Limited Liability Company',
  Corporation:          'Corporation',
  'S-Corp':             'Corporation', // S-Corp election is a separate add-on
  'Sole Proprietorship':'Sole Proprietorship',
  'Nonprofit':          'Nonprofit Corporation',
}

/** Map two-letter state abbreviations → full state names for NWRA */
const STATE_NAME_MAP: Record<string, string> = {
  AL: 'Alabama',        AK: 'Alaska',          AZ: 'Arizona',
  AR: 'Arkansas',       CA: 'California',       CO: 'Colorado',
  CT: 'Connecticut',    DE: 'Delaware',          FL: 'Florida',
  GA: 'Georgia',        HI: 'Hawaii',            ID: 'Idaho',
  IL: 'Illinois',       IN: 'Indiana',           IA: 'Iowa',
  KS: 'Kansas',         KY: 'Kentucky',          LA: 'Louisiana',
  ME: 'Maine',          MD: 'Maryland',          MA: 'Massachusetts',
  MI: 'Michigan',       MN: 'Minnesota',         MS: 'Mississippi',
  MO: 'Missouri',       MT: 'Montana',           NE: 'Nebraska',
  NV: 'Nevada',         NH: 'New Hampshire',      NJ: 'New Jersey',
  NM: 'New Mexico',     NY: 'New York',           NC: 'North Carolina',
  ND: 'North Dakota',   OH: 'Ohio',              OK: 'Oklahoma',
  OR: 'Oregon',         PA: 'Pennsylvania',       RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota',       TN: 'Tennessee',
  TX: 'Texas',          UT: 'Utah',              VT: 'Vermont',
  VA: 'Virginia',       WA: 'Washington',         WV: 'West Virginia',
  WI: 'Wisconsin',      WY: 'Wyoming',            DC: 'District of Columbia',
}

// ── JWT auth ─────────────────────────────────────────────────────────────────

/**
 * Build a per-request JWT for the Corporate Tools API.
 *
 * Header:  { alg: 'HS256', access_key: <access key> }
 * Payload: { path: <endpoint path>, content: sha256(queryString + requestBody) }
 * Signed with secret_key (HS256).
 */
async function buildAuthToken(
  path: string,
  body: string,
  queryString = '',
): Promise<string> {
  const accessKey = process.env.NWRA_ACCESS_KEY
  const secretKey = process.env.NWRA_SECRET_KEY
  if (!accessKey) throw new Error('NWRA_ACCESS_KEY is not set')
  if (!secretKey) throw new Error('NWRA_SECRET_KEY is not set')

  const content = createHash('sha256').update(queryString + body).digest('hex')
  const key = new TextEncoder().encode(secretKey)

  return new SignJWT({ path, content })
    .setProtectedHeader({ alg: 'HS256', access_key: accessKey })
    .sign(key)
}

/** Generic authenticated NWRA API call */
async function nwraRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
  queryString = '',
): Promise<T> {
  const bodyStr = body ? JSON.stringify(body) : ''
  const token = await buildAuthToken(path, bodyStr, queryString)

  const res = await fetch(`${NWRA_BASE_URL}${path}${queryString ? `?${queryString}` : ''}`, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(bodyStr ? { body: bodyStr } : {}),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'no response body')
    throw new Error(`NWRA ${method} ${path} error ${res.status}: ${errorText}`)
  }

  return res.json() as Promise<T>
}

// ── Step 1: Create company ────────────────────────────────────────────────────

async function createNwraCompany(order: Order): Promise<string> {
  const entityType = ENTITY_TYPE_MAP[order.entity_type ?? ''] ?? order.entity_type ?? ''
  const homeState  = STATE_NAME_MAP[order.formation_state ?? ''] ?? order.formation_state ?? ''

  if (!entityType) throw new Error(`Unknown entity type: ${order.entity_type}`)
  if (!homeState)  throw new Error(`Unknown formation state: ${order.formation_state}`)

  const data = await nwraRequest<{ result: Array<{ id: string }> }>(
    'POST',
    '/companies',
    {
      companies: [
        {
          name:        order.business_name_choice_1,
          entity_type: entityType,
          home_state:  homeState,
          duplicate_name_allowed: false,
        },
      ],
    },
  )

  const companyId = data.result?.[0]?.id
  if (!companyId) throw new Error('NWRA API returned no company ID')
  return companyId
}

// ── Step 2: Add to shopping cart ─────────────────────────────────────────────

async function addToNwraCart(
  companyId: string,
  productId: string,
  productOptionId: string,
): Promise<void> {
  await nwraRequest<{ result: { success: boolean } }>(
    'POST',
    '/shopping-cart',
    {
      company_id:        companyId,
      product_id:        productId,
      product_option_id: productOptionId,
      quantity:          1,
    },
  )
}

// ── Step 3: Checkout ──────────────────────────────────────────────────────────

async function checkoutNwraCart(
  companyId: string,
  productOptionId: string,
  paymentToken: string,
): Promise<string[]> {
  const data = await nwraRequest<{ invoice_ids: string[] }>(
    'POST',
    '/shopping-cart/checkout',
    {
      payment_token:     paymentToken,
      product_option_id: productOptionId,
      company_ids:       [companyId],
    },
  )
  return data.invoice_ids ?? []
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface NwraSubmitResult {
  nwra_company_id: string
  nwra_order_id: string
}

/**
 * Submit a formation order to the Corporate Tools API.
 *
 * Requires the following env vars to be set:
 *   NWRA_ACCESS_KEY          — your Corporate Tools access key
 *   NWRA_SECRET_KEY          — your Corporate Tools secret key
 *   NWRA_FORMATION_PRODUCT_ID — UUID of the formation filing product (from GET /filing-products)
 *   NWRA_STANDARD_OPTION_ID   — UUID of the standard filing method (from GET /filing-methods)
 *   NWRA_EXPEDITED_OPTION_ID  — UUID of the expedited filing method (from GET /filing-methods)
 *   NWRA_PAYMENT_TOKEN        — UUID of KelliWorks' saved payment method (from GET /payment-methods)
 */
export async function submitFormationOrder(
  order: Order,
  owners: (OrderOwner & { ssn_full?: string })[],
): Promise<NwraSubmitResult> {
  void owners // reserved for future form_data / BOI reporting steps

  const productId      = process.env.NWRA_FORMATION_PRODUCT_ID
  const standardOption = process.env.NWRA_STANDARD_OPTION_ID
  const expeditedOption= process.env.NWRA_EXPEDITED_OPTION_ID
  const paymentToken   = process.env.NWRA_PAYMENT_TOKEN

  if (!productId)       throw new Error('NWRA_FORMATION_PRODUCT_ID is not set')
  if (!standardOption)  throw new Error('NWRA_STANDARD_OPTION_ID is not set')
  if (!expeditedOption) throw new Error('NWRA_EXPEDITED_OPTION_ID is not set')
  if (!paymentToken)    throw new Error('NWRA_PAYMENT_TOKEN is not set')

  const isExpedited = order.addons?.expedited === true
  const productOptionId = isExpedited ? expeditedOption : standardOption

  // Step 1: Create the company in NWRA
  const companyId = await createNwraCompany(order)

  // Step 2: Add the formation filing product to the cart
  await addToNwraCart(companyId, productId, productOptionId)

  // Step 3: Checkout — NWRA charges KelliWorks' account and queues the filing
  // Returns invoice_ids immediately; actual confirmation arrives via paid-invoice callback
  const invoiceIds = await checkoutNwraCart(companyId, productOptionId, paymentToken)

  return {
    nwra_company_id: companyId,
    nwra_order_id:   invoiceIds[0] ?? companyId,
  }
}

/**
 * Poll for the current status of an NWRA order.
 * TODO: Implement once paid-invoice callback is set up (see Callbacks section in NWRA docs).
 */
export async function getNwraOrderStatus(nwraOrderId: string): Promise<string> {
  void nwraOrderId
  throw new Error('NWRA status polling not yet implemented')
}
