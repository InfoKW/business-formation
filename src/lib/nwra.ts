/**
 * Northwest Registered Agent / Corporate Tools API integration.
 *
 * Authentication: JWT with HS256
 *   Header:  { alg: 'HS256', access_key: NWRA_ACCESS_KEY }
 *   Payload: { path: '/companies', content: sha256(queryString + requestBody) }
 *   Signed with: NWRA_SECRET_KEY
 *
 * Formation filing flow:
 *   1. POST /companies                    → create company, get company_id
 *   2. GET  /filing-products/offerings    → look up product IDs for this company
 *   3. POST /shopping-cart (per product)  → add formation + each enabled add-on
 *   4. POST /shopping-cart/checkout       → place order against KelliWorks NWRA account
 *      Returns invoice_ids (async — actual confirmation via paid-invoice callback)
 *
 * ── OPEN ITEMS ───────────────────────────────────────────────────────────────
 *  1. Expedited filing_method name — we match "Expedited" by name; confirm the
 *     exact string returned by NWRA's API for expedited methods.
 *  3. paid-invoice callback — implement /api/webhooks/nwra to handle async
 *     order confirmation (see Callbacks section in NWRA docs).
 *  4. Test in NWRA sandbox before going live.
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

const ENTITY_TYPE_MAP: Record<string, string> = {
  LLC:                  'Limited Liability Company',
  Corporation:          'Corporation',
  'S-Corp':             'Corporation',
  'Sole Proprietorship':'Sole Proprietorship',
  'Nonprofit':          'Nonprofit Corporation',
}

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

// ── NWRA product filing_name identifiers ─────────────────────────────────────
// These match against the filing_name field returned by GET /filing-products/offerings.
// If NWRA changes their names, update these constants.

const FILING_NAME_FORMATION = 'form a company'
const FILING_NAME_EIN       = 'tax id'
const FILING_NAME_S_CORP    = 's corp'
const FILING_NAME_BOI       = 'beneficial ownership information report'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NwraFilingMethod {
  id:   string
  name: string // e.g. "Standard", "Expedited"
  type: string // e.g. "online", "mail", "fax"
  cost: string
}

interface NwraFilingProduct {
  id:             string
  name:           string
  filing_name:    string
  price:          number
  filing_methods: NwraFilingMethod[]
}

// ── JWT auth ─────────────────────────────────────────────────────────────────

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

async function nwraRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: { body?: Record<string, unknown>; query?: Record<string, string> } = {},
): Promise<T> {
  const queryString = options.query
    ? new URLSearchParams(options.query).toString()
    : ''
  const bodyStr = options.body ? JSON.stringify(options.body) : ''
  const token = await buildAuthToken(path, bodyStr, queryString)

  const url = `${NWRA_BASE_URL}${path}${queryString ? `?${queryString}` : ''}`
  const res = await fetch(url, {
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
      body: {
        companies: [
          {
            name:        order.business_name_choice_1,
            entity_type: entityType,
            home_state:  homeState,
            duplicate_name_allowed: false,
          },
        ],
      },
    },
  )

  const companyId = data.result?.[0]?.id
  if (!companyId) throw new Error('NWRA API returned no company ID')
  return companyId
}

// ── Step 2: Look up filing products ──────────────────────────────────────────

async function getFilingProducts(companyId: string): Promise<NwraFilingProduct[]> {
  const data = await nwraRequest<{ result: NwraFilingProduct[] }>(
    'GET',
    '/filing-products/offerings',
    { query: { company_id: companyId } },
  )
  return data.result ?? []
}

/**
 * Find a filing product by its filing_name (case-insensitive partial match)
 * and return the product_id + product_option_id for the requested speed.
 */
function resolveProduct(
  products: NwraFilingProduct[],
  filingName: string,
  expedited: boolean,
): { product_id: string; product_option_id: string } | null {
  const product = products.find((p) =>
    p.filing_name.toLowerCase().includes(filingName.toLowerCase()),
  )
  if (!product) return null

  const methods = product.filing_methods ?? []
  const method = expedited
    ? (methods.find((m) => m.name.toLowerCase().includes('expedited')) ?? methods[0])
    : (methods.find((m) => m.name.toLowerCase().includes('standard')) ?? methods[0])

  if (!method) return null

  return { product_id: product.id, product_option_id: method.id }
}

// ── Step 3: Add items to shopping cart ───────────────────────────────────────

async function addToCart(
  companyId: string,
  productId: string,
  productOptionId: string,
): Promise<void> {
  await nwraRequest<{ result: { success: boolean } }>(
    'POST',
    '/shopping-cart',
    {
      body: {
        company_id:        companyId,
        product_id:        productId,
        product_option_id: productOptionId,
        quantity:          1,
      },
    },
  )
}

// ── Payment method lookup ─────────────────────────────────────────────────────

/**
 * Get the payment token to use for NWRA checkout.
 * Uses NWRA_PAYMENT_TOKEN env var if set, otherwise fetches the first saved
 * card from GET /payment-methods on KelliWorks' NWRA account.
 * Note: NWRA requires a real saved card — test cards are not supported.
 */
async function getPaymentToken(): Promise<string> {
  // Env var override — useful if account has multiple cards
  if (process.env.NWRA_PAYMENT_TOKEN) return process.env.NWRA_PAYMENT_TOKEN

  const data = await nwraRequest<{ result: Array<{ id: string }> }>(
    'GET',
    '/payment-methods',
  )

  const token = data.result?.[0]?.id
  if (!token) {
    throw new Error(
      'No saved payment method found on NWRA account. ' +
      'Add a card at accounts.northwestregisteredagent.com or set NWRA_PAYMENT_TOKEN.',
    )
  }
  return token
}

// ── Step 4: Checkout ──────────────────────────────────────────────────────────

async function checkoutCart(
  companyId: string,
  productOptionId: string,
  paymentToken: string,
): Promise<string[]> {
  const data = await nwraRequest<{ invoice_ids: string[] }>(
    'POST',
    '/shopping-cart/checkout',
    {
      body: {
        payment_token:     paymentToken,
        product_option_id: productOptionId,
        company_ids:       [companyId],
      },
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
 * Required env vars:
 *   NWRA_ACCESS_KEY    — Corporate Tools access key
 *   NWRA_SECRET_KEY    — Corporate Tools secret key (signs JWTs)
 *   NWRA_PAYMENT_TOKEN — (optional) KelliWorks' saved payment method UUID.
 *                        If not set, the first card from GET /payment-methods is used.
 */
export async function submitFormationOrder(
  order: Order,
  owners: (OrderOwner & { ssn_full?: string })[],
): Promise<NwraSubmitResult> {
  void owners // reserved for future form_data fields

  const paymentToken = await getPaymentToken()

  const isExpedited = order.addons?.expedited === true

  // 1. Create company
  const companyId = await createNwraCompany(order)

  // 2. Fetch available filing products for this company
  const products = await getFilingProducts(companyId)

  // 3. Add formation product to cart
  const formation = resolveProduct(products, FILING_NAME_FORMATION, isExpedited)
  if (!formation) throw new Error('NWRA: "Form a Company" filing product not found for this company')
  await addToCart(companyId, formation.product_id, formation.product_option_id)

  // 4. Add enabled add-ons to cart
  if (order.addons?.ein) {
    const ein = resolveProduct(products, FILING_NAME_EIN, false)
    if (ein) await addToCart(companyId, ein.product_id, ein.product_option_id)
    else console.warn('[nwra] EIN Tax ID product not found in offerings - skipping')
  }

  if (order.addons?.s_corp_election) {
    const sCorp = resolveProduct(products, FILING_NAME_S_CORP, false)
    if (sCorp) await addToCart(companyId, sCorp.product_id, sCorp.product_option_id)
    else console.warn('[nwra] S Corp product not found in offerings - skipping')
  }

  if (order.addons?.boi_report) {
    const boi = resolveProduct(products, FILING_NAME_BOI, false)
    if (boi) await addToCart(companyId, boi.product_id, boi.product_option_id)
    else console.warn('[nwra] BOI Report product not found in offerings - skipping')
  }

  // 5. Checkout — charges KelliWorks NWRA account, returns invoice IDs
  const invoiceIds = await checkoutCart(companyId, formation.product_option_id, paymentToken)

  return {
    nwra_company_id: companyId,
    nwra_order_id:   invoiceIds[0] ?? companyId,
  }
}

export async function getNwraOrderStatus(nwraOrderId: string): Promise<string> {
  void nwraOrderId
  throw new Error('NWRA status polling not yet implemented')
}
