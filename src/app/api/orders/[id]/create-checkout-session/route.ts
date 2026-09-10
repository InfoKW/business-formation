/**
 * POST /api/orders/:id/create-checkout-session
 * Creates a Stripe Checkout Session and returns the hosted URL.
 * The browser is redirected to that URL so Stripe handles the payment UI.
 * In mock mode: returns a direct link to the confirmation page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isMockMode, mockStore } from '@/lib/mock-store'
import { computePrice } from '@/lib/pricing'
import type { EntityType, OrderAddons } from '@/types'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Derive origin from env var first, then fall back to request host
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    `https://${req.headers.get('host')}`

  try {
    // ── Mock mode ────────────────────────────────────────────────────────────
    if (isMockMode()) {
      const order = mockStore.getOrder(id)
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

      const breakdown = computePrice(
        (order.entity_type ?? 'LLC') as EntityType,
        order.formation_state ?? 'NJ',
        (order.addons ?? {}) as Partial<OrderAddons>,
      )
      mockStore.updateOrder(id, { status: 'pending_payment', price_cents: breakdown.total_cents })

      // Skip Stripe - send straight to confirmation
      return NextResponse.json({
        url: `${origin}/confirmation/${id}?mock=true`,
        breakdown,
      })
    }

    // ── Insforge + Stripe ─────────────────────────────────────────────────────
    const { createServiceClient } = await import('@/lib/insforge/server')
    const { stripe } = await import('@/lib/stripe')
    const insforge = createServiceClient()

    const { data: order, error: fetchError } = await insforge.database
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    if (!['draft', 'pending_payment'].includes(order.status)) {
      return NextResponse.json({ error: 'Order is already confirmed' }, { status: 409 })
    }
    if (!order.entity_type || !order.formation_state) {
      return NextResponse.json(
        { error: 'Order missing entity type or formation state' },
        { status: 422 },
      )
    }

    const breakdown = computePrice(
      order.entity_type as EntityType,
      order.formation_state,
      (order.addons ?? {}) as Partial<OrderAddons>,
    )

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: order.contact_email,
      metadata: { kelliworks_order_id: order.id },
      line_items: breakdown.line_items.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: { name: item.label },
          unit_amount: item.cents,
        },
        quantity: 1,
      })),
      // {CHECKOUT_SESSION_ID} is a Stripe template literal - filled in by Stripe at redirect time
      success_url: `${origin}/confirmation/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/apply`,
    })

    await insforge.database
      .from('orders')
      .update({
        status: 'pending_payment',
        price_cents: breakdown.total_cents,
        stripe_checkout_session_id: session.id,
      })
      .eq('id', id)

    return NextResponse.json({ url: session.url, breakdown })
  } catch (err) {
    console.error('[POST create-checkout-session]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
