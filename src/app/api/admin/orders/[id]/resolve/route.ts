/**
 * POST /api/admin/orders/:id/resolve
 *
 * Mark an nwra_error order as manually resolved (filed_with_nwra).
 * Used when staff creates the formation manually in the Corporate Tools
 * dashboard rather than through the API retry.
 * Auth-protected via middleware.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge/server'
import { sendFiledWithNwraEmail } from '@/lib/email'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const insforge = createServiceClient()

    const { data: order, error: fetchError } = await insforge.database
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    if (order.status !== 'nwra_error') {
      return NextResponse.json(
        { error: `Cannot resolve - order status is "${order.status}", must be "nwra_error"` },
        { status: 409 },
      )
    }

    await insforge.database
      .from('orders')
      .update({ status: 'filed_with_nwra', nwra_error_message: null })
      .eq('id', id)

    await insforge.database.from('order_events').insert({
      order_id:   id,
      event_type: 'status_change',
      detail:     { from: 'nwra_error', to: 'filed_with_nwra', triggered_by: 'admin_manual_resolve' },
    })

    await sendFiledWithNwraEmail(
      order.contact_email,
      order.id,
      order.status_token,
      order.business_name_choice_1 ?? 'your business',
    ).catch((err) => console.error('[admin/resolve] filed email failed:', err))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/admin/orders/:id/resolve]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
