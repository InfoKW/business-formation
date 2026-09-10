/**
 * Northwest Registered Agent / Corporate Tools API integration.
 *
 * Authentication: JWT with HS256
 *   Header:  { alg: 'HS256', access_key: NWRA_ACCESS_KEY }
 *   Payload: { path: '/companies', content: sha256(queryString + requestBody) }
 *   Signed with: NWRA_SECRET_KEY
 *
 * Company creation: POST /companies
 *   entity_type must be the full NWRA constant string (e.g. "Limited Liability Company")
 *   home_state must be the full state name (e.g. "New Jersey")
 *
 * ── OPEN ITEMS ───────────────────────────────────────────────────────────────
 *  1. Formation order placement — POST /companies creates the company record.
 *     Confirm whether a separate call (Order Items / Shopping Cart / Filing Products)
 *     is needed to actually place the formation filing order, or if company creation
 *     is sufficient for wholesale partners.
 *  2. Add-on attachment (EIN, S-Corp election, expedited, BOI report) — confirm
 *     which endpoint accepts these after company creation.
 *  3. NWRA status sync — confirm webhook (Callbacks) vs polling mechanism.
 *  4. Test in NWRA sandbox before pointing at production.
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
 *
 * @param path - The API path for this request, e.g. '/companies'
 * @param body - The raw JSON request body string ('' for GET requests)
 * @param queryString - The query string without '?' ('' for most requests)
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

// ── Company creation ──────────────────────────────────────────────────────────

export interface NwraSubmitResult {
  nwra_company_id: string
  nwra_order_id: string
}

/**
 * Submit a formation order to the Corporate Tools API.
 *
 * Step 1: POST /companies — creates the company record in NWRA's system.
 * TODO: Confirm whether a separate order/filing call is needed after this
 * (Shopping Cart, Order Items, or Filing Products endpoint).
 *
 * @param order  - The confirmed order row from the database
 * @param owners - Owner rows with ssn_full populated (decrypted by caller, never logged)
 */
export async function submitFormationOrder(
  order: Order,
  owners: (OrderOwner & { ssn_full?: string })[],
): Promise<NwraSubmitResult> {
  void owners // owners used for future order-item / BOI steps; passed through now

  const entityType = ENTITY_TYPE_MAP[order.entity_type ?? ''] ?? order.entity_type ?? ''
  const homeState  = STATE_NAME_MAP[order.formation_state ?? ''] ?? order.formation_state ?? ''

  if (!entityType) throw new Error(`Unknown entity type: ${order.entity_type}`)
  if (!homeState)  throw new Error(`Unknown formation state: ${order.formation_state}`)

  const path = '/companies'
  const requestBody = JSON.stringify({
    companies: [
      {
        name:       order.business_name_choice_1,
        entity_type: entityType,
        home_state:  homeState,
        duplicate_name_allowed: false,
      },
    ],
  })

  const token = await buildAuthToken(path, requestBody)

  const response = await fetch(`${NWRA_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: requestBody,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'no response body')
    throw new Error(`NWRA API error ${response.status}: ${errorText}`)
  }

  const data = await response.json() as { result: Array<{ id: string }> }
  const companyId = data.result?.[0]?.id ?? ''

  if (!companyId) {
    throw new Error('NWRA API returned no company ID in result')
  }

  // TODO: Place the formation filing order (Order Items / Shopping Cart)
  // and return the actual nwra_order_id once that endpoint is confirmed.
  return {
    nwra_company_id: companyId,
    nwra_order_id:   companyId, // placeholder until filing order endpoint confirmed
  }
}

/**
 * Poll for the current status of an NWRA order.
 * TODO: Implement once the status sync mechanism is confirmed (Callbacks webhook vs polling).
 */
export async function getNwraOrderStatus(nwraOrderId: string): Promise<string> {
  void nwraOrderId
  throw new Error('NWRA status polling not yet implemented')
}
