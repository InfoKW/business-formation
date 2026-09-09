/**
 * Transactional notifications via GHL (GoHighLevel) webhooks.
 *
 * Each function POSTs a payload to a GHL workflow webhook URL.
 * Set up one GHL workflow per event and paste its webhook URL into the env var.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://formation.kelliworks.com'

async function postToGHL(webhookUrl: string | undefined, payload: Record<string, string>): Promise<void> {
  if (!webhookUrl) {
    console.warn('[email] GHL webhook URL not set - skipping notification')
    return
  }
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[email] GHL webhook failed:', err)
  }
}

/** payment_confirmed - triggers GHL_WEBHOOK_PAYMENT_CONFIRMED workflow */
export async function sendPaymentConfirmedEmail(
  to: string,
  orderId: string,
  statusToken: string,
  businessName: string,
): Promise<void> {
  await postToGHL(process.env.GHL_WEBHOOK_PAYMENT_CONFIRMED, {
    email: to,
    order_id: orderId,
    business_name: businessName,
    status_url: `${APP_URL}/status/${statusToken}`,
    event: 'payment_confirmed',
  })
}

/** filed_with_nwra - triggers GHL_WEBHOOK_FILED workflow */
export async function sendFiledWithNwraEmail(
  to: string,
  orderId: string,
  statusToken: string,
  businessName: string,
): Promise<void> {
  await postToGHL(process.env.GHL_WEBHOOK_FILED, {
    email: to,
    order_id: orderId,
    business_name: businessName,
    status_url: `${APP_URL}/status/${statusToken}`,
    event: 'filed_with_nwra',
  })
}

/** complete - triggers GHL_WEBHOOK_COMPLETE workflow */
export async function sendCompleteEmail(
  to: string,
  businessName: string,
): Promise<void> {
  await postToGHL(process.env.GHL_WEBHOOK_COMPLETE, {
    email: to,
    business_name: businessName,
    event: 'complete',
  })
}
