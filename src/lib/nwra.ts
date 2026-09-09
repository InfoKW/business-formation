/**
 * Northwest Registered Agent / Corporate Tools API integration.
 *
 * ── OPEN ITEMS - do not build this section until confirmed ──────────────────
 *
 *  1. JWT signing spec: algorithm (RS256? HS256?), required claims, token
 *     expiry/refresh behavior. Check the Corporate Tools portal under
 *     Account Settings → API Management and the official examples at:
 *     github.com/corptools-api/CorpTools-API-Examples
 *
 *  2. Exact endpoint(s) for creating a company record and placing a formation
 *     order, and how add-ons (EIN, S-Corp election, expedited, BOI report)
 *     attach to that order.
 *
 *  3. Status sync mechanism: do they push webhooks, or must we poll a GET
 *     endpoint? NWRA's wholesale-partner page hints at real-time updates -
 *     confirm which mechanism.
 *
 *  4. Sandbox / test environment availability - confirm before pointing at
 *     production.
 *
 * ── What this integration does (per PRD §9 / §11) ──────────────────────────
 *
 *  Calling this API places the formation *order* into NWRA's fulfillment queue.
 *  It does NOT instantly file with any Secretary of State. NWRA's own operations
 *  team handles the actual state filing. The client-facing message must reflect
 *  this: "submitted for processing", not "your business is formed".
 *
 * ── SSN handling ────────────────────────────────────────────────────────────
 *
 *  Full SSNs are decrypted from the DB here, passed to the NWRA API in memory,
 *  and are NOT logged, not written to order_events, not cached anywhere.
 *  On successful NWRA submission the ssn_encrypted column is deleted.
 */

import { SignJWT } from 'jose'
import type { Order, OrderOwner } from '@/types'

const NWRA_BASE_URL = 'https://api.corporatetools.com'

// ── JWT auth ─────────────────────────────────────────────────────────────────

async function buildAuthToken(): Promise<string> {
  const apiKey = process.env.NWRA_API_KEY
  if (!apiKey) throw new Error('NWRA_API_KEY is not set')

  // TODO: Fill in the correct JWT signing spec once confirmed from the Corporate
  // Tools portal. The algorithm, claims, and signing key format below are
  // PLACEHOLDERS based on the public docs ("a JWT library for signing
  // authorization tokens") - replace before going live.
  //
  // Example for HS256 with a shared secret key:
  const key = new TextEncoder().encode(apiKey)
  const token = await new SignJWT({ iss: 'kelliworks' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key)

  return token
}

// ── Payload mapping ──────────────────────────────────────────────────────────

/**
 * Map a KelliWorks order + owners into the Corporate Tools API payload shape.
 *
 * TODO: Replace the property names and nesting with the actual payload schema
 * from the Corporate Tools docs / C# examples once confirmed.
 *
 * @param decryptedSsns - Map of owner_id → full SSN string (decrypted in the
 *   calling function, passed in here for NWRA submission, never logged)
 */
function buildNwraPayload(
  order: Order,
  owners: (OrderOwner & { ssn_full?: string })[],
): Record<string, unknown> {
  // TODO: Replace with confirmed Corporate Tools payload shape.
  return {
    companyName: order.business_name_choice_1,
    alternateCompanyName: order.business_name_choice_2 ?? undefined,
    entityType: order.entity_type,
    formationState: order.formation_state,
    businessAddress: order.business_address,
    description: order.business_description,
    anticipatedStartDate: order.anticipated_start_date,
    addons: {
      ein: order.addons?.ein ?? false,
      sCorpElection: order.addons?.s_corp_election ?? false,
      expedited: order.addons?.expedited ?? false,
      boiReport: order.addons?.boi_report ?? false,
    },
    members: owners.map((o) => ({
      firstName: o.first_name,
      middleName: o.middle_name ?? undefined,
      lastName: o.last_name,
      dateOfBirth: o.date_of_birth,
      ownershipPercentage: o.ownership_percentage,
      ssn: o.ssn_full,   // full SSN - passed in memory, never stored here
      citizenshipStatus: o.citizenship_status,
      mailingAddress: o.mailing_address,
      personalAddress: o.personal_address ?? undefined,
      phone: o.phone,
      email: o.email,
    })),
  }
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface NwraSubmitResult {
  nwra_company_id: string
  nwra_order_id: string
}

/**
 * Submit a formation order to the Corporate Tools API.
 *
 * @param order - The confirmed order row from the database
 * @param owners - Owner rows with ssn_full populated (decrypted by caller)
 * @throws on any API error - caller must handle and write nwra_error status
 */
export async function submitFormationOrder(
  order: Order,
  owners: (OrderOwner & { ssn_full?: string })[],
): Promise<NwraSubmitResult> {
  const token = await buildAuthToken()
  const payload = buildNwraPayload(order, owners)

  // TODO: Replace '/companies' with the confirmed endpoint path.
  const response = await fetch(`${NWRA_BASE_URL}/companies`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'no response body')
    throw new Error(`NWRA API error ${response.status}: ${errorText}`)
  }

  const data = await response.json() as Record<string, unknown>

  // TODO: Map the actual response fields to these IDs once the API shape is known.
  return {
    nwra_company_id: String(data.companyId ?? data.company_id ?? data.id ?? ''),
    nwra_order_id:   String(data.orderId   ?? data.order_id   ?? data.id ?? ''),
  }
}

/**
 * Poll for the current status of an NWRA order.
 *
 * TODO: Implement once the status sync mechanism is confirmed (polling vs webhook).
 * If they push webhooks, create /api/webhooks/nwra instead of calling this.
 */
export async function getNwraOrderStatus(nwraOrderId: string): Promise<string> {
  void nwraOrderId
  // TODO: implement
  throw new Error('NWRA status polling not yet implemented - confirm mechanism with Corporate Tools')
}
