import Stripe from 'stripe'

// Server-side Stripe client - uses the secret key, never exposed to the browser
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})

/**
 * Verify a Stripe webhook signature and return the parsed event.
 * The raw request body (string) must be passed - do not parse as JSON first.
 * Throws if verification fails.
 */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  )
}
