/**
 * POST /api/orders/:id/create-payment-intent
 * Computes price server-side, creates a Stripe PaymentIntent, returns client_secret.
 * In mock mode: returns a fake client_secret so the UI can render the payment step.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isMockMode, mockStore } from '@/lib/mock-store'
import { computePrice } from '@/lib/pricing'
import type { EntityType, OrderAddons } from '@/types'

type RouteContext = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    // ── Mock mode ────────────────────────────────────────────────────────────
    if (isMockMode()) {
      const order = mockStore.getOrder(params.id)
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

      const breakdown = computePrice(
        (order.entity_type ?? 'LLC') as EntityType,
        order.formation_state ?? 'NJ',
        (order.addons ?? {}) as Partial<OrderAddons>,
      )
      mockStore.updateOrder(params.id, {
        status: 'pending_payment',
        price_cents: breakdown.total_cents,
        stripe_payment_intent_id: 'mock_pi_' + params.id,
      })
      return NextResponse.json({
        clientSecret: 'mock_secret_' + params.id + '_secret',
        breakdown,
        mock: true,
      })
    }

    // ── Insforge + Stripe ─────────────────────────────────────────────────────
    const { createServiceClient } = await import('@/lib/insforge/server')
    const { stripe } = await import('@/lib/stripe')
    const insforge = createServiceClient()

    const { data: order, error: fetchError } = await insforge.database
      .from('formation.orders')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    if (!['draft', 'pending_payment'].includes(order.status)) {
      return NextResponse.json({ error: 'Order is already confirmed' }, { status: 409 })
    }
    if (!order.entity_type || !order.formation_state) {
      return NextResponse.json({ error: 'Order missing entity type or formation state' }, { status: 422 })
    }

    const breakdown = computePrice(
      order.entity_type as EntityType,
      order.formation_state,
      (order.addons ?? {}) as Partial<OrderAddons>,
    )

    let clientSecret: string

    if (order.stripe_payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id)
      if (['requires_payment_method', 'requires_confirmation'].includes(existing.status)) {
        clientSecret = existing.client_secret!
      } else {
        const pi = await stripe.paymentIntents.create({
          amount:        breakdown.total_cents,
          currency:      'usd',
          metadata:      { kelliworks_order_id: order.id },
          receipt_email: order.contact_email,
        })
        clientSecret = pi.client_secret!
        await insforge.database
          .from('formation.orders')
          .update({ stripe_payment_intent_id: pi.id })
          .eq('id', params.id)
      }
    } else {
      const pi = await stripe.paymentIntents.create({
        amount:        breakdown.total_cents,
        currency:      'usd',
        metadata:      { kelliworks_order_id: order.id },
        receipt_email: order.contact_email,
        description:   `Business Formation - ${order.business_name_choice_1 ?? order.id}`,
      })
      clientSecret = pi.client_secret!
      await insforge.database
        .from('formation.orders')
        .update({
          stripe_payment_intent_id: pi.id,
          price_cents:              breakdown.total_cents,
          status:                   'pending_payment',
        })
        .eq('id', params.id)
    }

    return NextResponse.json({ clientSecret, breakdown })
  } catch (err) {
    console.error('[POST create-payment-intent]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
