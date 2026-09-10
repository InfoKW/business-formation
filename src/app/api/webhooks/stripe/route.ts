/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook receiver. Handles checkout.session.completed (primary)
 * and payment_intent.succeeded (fallback / direct PI flows).
 *
 * Security requirements:
 *   1. Verify the webhook signature against the raw request body.
 *      Never parse the body as JSON before verification.
 *   2. Idempotency: if order is already payment_confirmed or later, return 200
 *      and do nothing. Don't rely solely on Stripe event IDs.
 *   3. Do NOT call the NWRA API inline - return 200 fast, then run NWRA
 *      submission asynchronously. Stripe will retry on timeouts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { sendPaymentConfirmedEmail } from '@/lib/email'
import { createServiceClient } from '@/lib/insforge/server'
import type { Order } from '@/types'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const TERMINAL_STATUSES = ['payment_confirmed', 'filed_with_nwra', 'nwra_error', 'complete']

async function confirmOrder(orderId: string, stripeEventId: string, paymentIntentId?: string) {
  const insforge = createServiceClient()

  const { data: order, error: fetchError } = await insforge.database
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()

  if (fetchError) throw fetchError

  if (!order) {
    console.error('[stripe-webhook] Order not found:', orderId)
    return
  }

  // Idempotency guard
  if (TERMINAL_STATUSES.includes(order.status)) {
    console.log(`[stripe-webhook] Order ${orderId} already at ${order.status} - skipping`)
    return
  }

  // Advance to payment_confirmed
  await insforge.database
    .from('orders')
    .update({
      status: 'payment_confirmed',
      stripe_payment_status: 'succeeded',
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
    })
    .eq('id', orderId)

  await insforge.database.from('order_events').insert([
    {
      order_id:   orderId,
      event_type: 'stripe_webhook_received',
      detail: {
        stripe_event_id:   stripeEventId,
        payment_intent_id: paymentIntentId ?? null,
      },
    },
    {
      order_id:   orderId,
      event_type: 'status_change',
      detail:     { from: 'pending_payment', to: 'payment_confirmed' },
    },
  ])

  // Send confirmation email
  await sendPaymentConfirmedEmail(
    (order as Order).contact_email,
    order.id,
    order.status_token,
    order.business_name_choice_1 ?? 'your business',
  ).catch((err) => console.error('[stripe-webhook] confirmation email failed:', err))

  // Trigger NWRA submission asynchronously
  setImmediate(async () => {
    try {
      const { processNwraSubmission } = await import('@/lib/nwra-submit')
      await processNwraSubmission(orderId)
    } catch (err) {
      console.error('[stripe-webhook] NWRA background job failed:', err)
    }
  })
}

export async function POST(req: NextRequest) {
  const rawBody  = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = constructWebhookEvent(rawBody, signature)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      // Only process paid sessions (mode=payment sessions can be 'paid' or 'unpaid')
      if (session.payment_status !== 'paid') {
        return NextResponse.json({ received: true })
      }

      const orderId = session.metadata?.kelliworks_order_id
      if (!orderId) {
        console.error('[stripe-webhook] Checkout session missing kelliworks_order_id:', session.id)
        return NextResponse.json({ received: true })
      }

      await confirmOrder(orderId, event.id, session.payment_intent as string | undefined)
      return NextResponse.json({ received: true })
    }

    if (event.type === 'payment_intent.succeeded') {
      // Kept for backwards compatibility / direct PaymentIntent flows
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const orderId = paymentIntent.metadata?.kelliworks_order_id
      if (!orderId) {
        console.error('[stripe-webhook] PaymentIntent missing kelliworks_order_id:', paymentIntent.id)
        return NextResponse.json({ received: true })
      }
      await confirmOrder(orderId, event.id, paymentIntent.id)
      return NextResponse.json({ received: true })
    }

    // All other events - acknowledge and ignore
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[stripe-webhook] Error processing event:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
