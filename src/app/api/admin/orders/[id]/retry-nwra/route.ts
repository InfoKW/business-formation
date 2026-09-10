/**
 * POST /api/admin/orders/:id/retry-nwra
 *
 * Re-runs the NWRA submission for an order in nwra_error status.
 * Auth-protected via middleware.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const insforge = createServiceClient()

    const { data: order, error: fetchError } = await insforge.database
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    if (order.status !== 'nwra_error') {
      return NextResponse.json(
        { error: `Cannot retry - order status is "${order.status}", must be "nwra_error"` },
        { status: 409 },
      )
    }

    // Reset to payment_confirmed so the submission job can run again
    await insforge.database
      .from('orders')
      .update({ status: 'payment_confirmed', nwra_error_message: null })
      .eq('id', id)

    await insforge.database.from('order_events').insert({
      order_id:   id,
      event_type: 'status_change',
      detail:     { from: 'nwra_error', to: 'payment_confirmed', triggered_by: 'admin_retry' },
    })

    setImmediate(async () => {
      try {
        const { processNwraSubmission } = await import('@/lib/nwra-submit')
        await processNwraSubmission(id)
      } catch (err) {
        console.error('[admin/retry-nwra] background job failed:', err)
      }
    })

    return NextResponse.json({ ok: true, message: 'NWRA submission queued' })
  } catch (err) {
    console.error('[POST /api/admin/orders/:id/retry-nwra]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
