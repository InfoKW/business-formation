/**
 * POST /api/orders - create a new draft order (Step 1 submit)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isMockMode, mockStore } from '@/lib/mock-store'

const schema = z.object({
  business_name_choice_1: z.string().min(1, 'Business name is required'),
  business_name_choice_2: z.string().optional(),
  entity_type: z.string().min(1),
  formation_state: z.string().min(1),
  business_description: z.string().min(1),
  business_address: z.string().min(1),
  anticipated_start_date: z.string().min(1),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const d = parsed.data

    // ── Mock mode (no database) ──────────────────────────────────────────────
    if (isMockMode()) {
      const order = mockStore.createOrder({
        business_name_choice_1: d.business_name_choice_1,
        business_name_choice_2: d.business_name_choice_2 ?? null,
        entity_type: d.entity_type,
        formation_state: d.formation_state,
        business_description: d.business_description,
        business_address: d.business_address,
        anticipated_start_date: d.anticipated_start_date,
        contact_email: d.contact_email,
        contact_phone: d.contact_phone ?? null,
      })
      return NextResponse.json({ id: order.id, status_token: order.status_token }, { status: 201 })
    }

    // ── Insforge ─────────────────────────────────────────────────────────────
    const { createServiceClient } = await import('@/lib/insforge/server')
    const insforge = createServiceClient()

    const { data: order, error } = await insforge.database
      .from('formation.orders')
      .insert({
        business_name_choice_1: d.business_name_choice_1,
        business_name_choice_2: d.business_name_choice_2 ?? null,
        entity_type:            d.entity_type,
        formation_state:        d.formation_state,
        business_description:   d.business_description,
        business_address:       d.business_address,
        anticipated_start_date: d.anticipated_start_date,
        contact_email:          d.contact_email,
        contact_phone:          d.contact_phone ?? null,
      })
      .select('id, status_token')
      .single()

    if (error) throw error

    await insforge.database.from('formation.order_events').insert({
      order_id:   order.id,
      event_type: 'status_change',
      detail:     { from: null, to: 'draft' },
    })

    return NextResponse.json({ id: order.id, status_token: order.status_token }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/orders]', err)
    return NextResponse.json({
      error: 'Server error',
      debug_mock: process.env.MOCK_DB,
      debug_detail: err instanceof Error ? err.message : JSON.stringify(err),
    }, { status: 500 })
  }
}
