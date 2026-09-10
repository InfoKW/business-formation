/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook receiver. Subscribed to payment_intent.succeeded.
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

  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true })
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const orderId = paymentIntent.metadata?.kelliworks_order_id

  if (!orderId) {
    console.error('[stripe-webhook] PaymentIntent missing kelliworks_order_id metadata:', paymentIntent.id)
    return NextResponse.json({ received: true })
  }

  try {
    const insforge = createServiceClient()

    const { data: order, error: fetchError } = await insforge.database
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchError) throw fetchError

    if (!order) {
      console.error('[stripe-webhook] Order not found:', orderId)
      return NextResponse.json({ received: true })
    }

    // Idempotency guard - if already confirmed or later, do nothing
    const TERMINAL_STATUSES = ['payment_confirmed', 'filed_with_nwra', 'nwra_error', 'complete']
    if (TERMINAL_STATUSES.includes(order.status)) {
      console.log(`[stripe-webhook] Order ${orderId} already at ${order.status} - skipping`)
      return NextResponse.json({ received: true })
    }

    // Advance to payment_confirmed
    await insforge.database
      .from('orders')
      .update({ status: 'payment_confirmed', stripe_payment_status: paymentIntent.status })
      .eq('id', orderId)

    await insforge.database.from('order_events').insert([
      {
        order_id:   orderId,
        event_type: 'stripe_webhook_received',
        detail: {
          stripe_event_id:   event.id,
          payment_intent_id: paymentIntent.id,
          amount:            paymentIntent.amount,
        },
      },
      {
        order_id:   orderId,
        event_type: 'status_change',
        detail:     { from: 'pending_payment', to: 'payment_confirmed' },
      },
    ])

    // Send payment confirmation email to client
    await sendPaymentConfirmedEmail(
      (order as Order).contact_email,
      order.id,
      order.status_token,
      order.business_name_choice_1 ?? 'your business',
    ).catch((err) => console.error('[stripe-webhook] confirmation email failed:', err))

    // Trigger NWRA submission asynchronously - do NOT await before returning 200.
    // In production, replace setImmediate with a proper background job (Inngest, pg-boss, etc.)
    setImmediate(async () => {
      try {
        const { processNwraSubmission } = await import('@/lib/nwra-submit')
        await processNwraSubmission(orderId)
      } catch (err) {
        console.error('[stripe-webhook] NWRA background job failed:', err)
      }
    })

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[stripe-webhook] Error processing event:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
