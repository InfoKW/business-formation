/**
 * Server-side price computation.
 *
 * OPEN ITEM: The real price matrix (by entity type, state, add-ons, filing speed)
 * has not been confirmed. The values below are PLACEHOLDERS based on the $700 flat
 * example seen in the GHL prototype. Replace with the real table once Kelli confirms.
 *
 * CRITICAL: price_cents is always computed here on the server. The client never
 * sends a price - any client-supplied amount is ignored.
 */
import type { EntityType, OrderAddons, PriceBreakdown } from '@/types'

// ── Base price by entity type ─────────────────────────────────────────────────
// TODO: Replace with confirmed pricing table. Values in cents.
const BASE_PRICE_BY_ENTITY: Record<string, number> = {
  'LLC':                       70000,  // $700.00 - placeholder
  'S-Corp':                    70000,
  'C-Corp':                    70000,
  'Sole Proprietorship':       70000,
  'Partnership':               70000,
  'Non-Profit':                70000,
  'Not sure - advise me':      70000,
}

// TODO: Add per-state surcharges/overrides once the pricing table is confirmed.
// const STATE_SURCHARGE: Record<string, number> = { NJ: 5000, FL: 0, ... }

// ── Add-on prices ─────────────────────────────────────────────────────────────
// TODO: Confirm with Kelli. Values in cents.
const ADDON_EIN_CENTS         = 0       // Often included - confirm
const ADDON_S_CORP_CENTS      = 0       // Confirm
const ADDON_EXPEDITED_CENTS   = 15000   // $150.00 - placeholder
const ADDON_BOI_CENTS         = 0       // Confirm

export function computePrice(
  entityType: EntityType,
  formationState: string,
  addons: Partial<OrderAddons>,
): PriceBreakdown {
  const base_cents = BASE_PRICE_BY_ENTITY[entityType] ?? 70000
  const addon_ein_cents       = addons.ein           ? ADDON_EIN_CENTS       : 0
  const addon_s_corp_cents    = addons.s_corp_election ? ADDON_S_CORP_CENTS  : 0
  const addon_expedited_cents = addons.expedited      ? ADDON_EXPEDITED_CENTS : 0
  const addon_boi_cents       = addons.boi_report     ? ADDON_BOI_CENTS      : 0

  const total_cents =
    base_cents +
    addon_ein_cents +
    addon_s_corp_cents +
    addon_expedited_cents +
    addon_boi_cents

  const line_items: { label: string; cents: number }[] = [
    { label: `Business Formation (${entityType} - ${formationState})`, cents: base_cents },
  ]
  if (addon_ein_cents > 0) line_items.push({ label: 'EIN / Federal Tax ID', cents: addon_ein_cents })
  if (addon_s_corp_cents > 0) line_items.push({ label: 'S-Corp Election', cents: addon_s_corp_cents })
  if (addon_expedited_cents > 0) line_items.push({ label: 'Expedited Filing', cents: addon_expedited_cents })
  if (addon_boi_cents > 0) line_items.push({ label: 'BOI Report', cents: addon_boi_cents })

  return {
    base_cents,
    addon_ein_cents,
    addon_s_corp_cents,
    addon_expedited_cents,
    addon_boi_cents,
    total_cents,
    line_items,
  }
}

export function formatDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}
