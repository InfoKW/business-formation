/**
 * Background NWRA submission job - runs after payment_confirmed.
 *
 * This is called from the Stripe webhook handler (NOT inline - the webhook
 * must return 200 quickly; this runs asynchronously via a background task).
 *
 * In a simple Vercel deployment, use Next.js background functions or a
 * minimal queue (e.g. an immediate async call in a setTimeout(fn, 0) block
 * after the webhook response). For higher reliability, use a proper job queue
 * (e.g. pg-boss, Inngest, or a cron that polls for payment_confirmed orders).
 */
import { createServiceClient } from '@/lib/insforge/server'
import { decrypt } from '@/lib/crypto'
import { submitFormationOrder } from '@/lib/nwra'
import { alertNwraError } from '@/lib/alerts'
import { sendFiledWithNwraEmail } from '@/lib/email'
import type { Order, OrderOwner } from '@/types'

export async function processNwraSubmission(orderId: string): Promise<void> {
  const insforge = createServiceClient()

  // 1. Load order
  const { data: order, error: orderError } = await insforge.database
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    console.error(`[nwra-submit] Failed to fetch order ${orderId}:`, orderError)
    return
  }
  if (!order) {
    console.error(`[nwra-submit] Order ${orderId} not found`)
    return
  }

  // Guard: only process if status is exactly payment_confirmed
  if (order.status !== 'payment_confirmed') {
    console.warn(`[nwra-submit] Order ${orderId} is ${order.status} - skipping`)
    return
  }

  // 2. Load owners (including encrypted SSNs - backend only, never sent to client)
  const { data: ownersRaw } = await insforge.database
    .from('order_owners')
    .select('*')
    .eq('order_id', orderId)

  // 3. Decrypt SSNs in memory - do NOT log, cache, or write them anywhere
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const owners = (ownersRaw ?? []).map((o: any) => ({
    ...o,
    ssn_full: o.ssn_encrypted ? decrypt(o.ssn_encrypted) : undefined,
  }))

  // 4. Write audit event for the attempt
  await insforge.database.from('order_events').insert({
    order_id:   orderId,
    event_type: 'nwra_call_attempted',
    detail:     { timestamp: new Date().toISOString() },
  })

  try {
    // 5. Call Corporate Tools API
    const result = await submitFormationOrder(order as Order, owners)

    // 6. Success: update order, clear encrypted SSNs
    await insforge.database
      .from('orders')
      .update({
        status:          'filed_with_nwra',
        nwra_company_id: result.nwra_company_id,
        nwra_order_id:   result.nwra_order_id,
      })
      .eq('id', orderId)

    await insforge.database.from('order_events').insert({
      order_id:   orderId,
      event_type: 'status_change',
      detail: {
        from:            'payment_confirmed',
        to:              'filed_with_nwra',
        nwra_company_id: result.nwra_company_id,
        nwra_order_id:   result.nwra_order_id,
      },
    })

    // Delete encrypted SSNs now that NWRA has them - no need to retain
    await insforge.database
      .from('order_owners')
      .update({ ssn_encrypted: null })
      .eq('order_id', orderId)

    // 7. Send "filed" email to client
    await sendFiledWithNwraEmail(
      (order as Order).contact_email,
      order.id,
      order.status_token,
      order.business_name_choice_1 ?? 'your business',
    ).catch((err) => console.error('[nwra-submit] filed email failed:', err))

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[nwra-submit] NWRA submission failed for order ${orderId}:`, message)

    // 8. Failure: set nwra_error, write audit rows, fire alert
    await insforge.database
      .from('orders')
      .update({ status: 'nwra_error', nwra_error_message: message })
      .eq('id', orderId)

    await insforge.database.from('order_events').insert([
      {
        order_id:   orderId,
        event_type: 'nwra_call_failed',
        detail:     { error: message },
      },
      {
        order_id:   orderId,
        event_type: 'status_change',
        detail:     { from: 'payment_confirmed', to: 'nwra_error', error: message },
      },
    ])

    // Fire alert - client has already paid, this cannot be silent
    await alertNwraError(orderId, message)
  }
}
