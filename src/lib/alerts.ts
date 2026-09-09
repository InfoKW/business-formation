/**
 * Internal alerting - fires on nwra_error (PRD §13).
 *
 * POSTs to a GHL webhook so Kelli's team gets notified immediately.
 * Also supports optional Slack webhook.
 */

async function sendGHLAlert(orderId: string, errorMessage: string): Promise<void> {
  const webhookUrl = process.env.GHL_WEBHOOK_NWRA_ERROR
  if (!webhookUrl) {
    console.warn('[alerts] GHL_WEBHOOK_NWRA_ERROR not set - skipping GHL alert')
    return
  }
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'nwra_error',
        order_id: orderId,
        error: errorMessage,
      }),
    })
  } catch (err) {
    console.error('[alerts] GHL alert failed:', err)
  }
}

async function sendSlackAlert(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })
  } catch (err) {
    console.error('[alerts] Slack alert failed:', err)
  }
}

export async function alertNwraError(orderId: string, errorMessage: string): Promise<void> {
  const slackMsg = [
    '*ACTION REQUIRED: NWRA submission failed after payment*',
    `Order: \`${orderId}\``,
    `Error: ${errorMessage}`,
  ].join('\n')

  await Promise.allSettled([
    sendGHLAlert(orderId, errorMessage),
    sendSlackAlert(slackMsg),
  ])
}
