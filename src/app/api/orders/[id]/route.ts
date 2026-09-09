/**
 * PATCH /api/orders/:id - update an order during steps 1-3
 * GET  /api/orders/:id - retrieve an order
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isMockMode, mockStore } from '@/lib/mock-store'

const patchSchema = z.object({
  business_name_choice_1:          z.string().optional(),
  business_name_choice_2:          z.string().optional(),
  entity_type:                     z.string().optional(),
  formation_state:                 z.string().optional(),
  business_description:            z.string().optional(),
  business_address:                z.string().optional(),
  anticipated_start_date:          z.string().optional(),
  contact_email:                   z.string().email().optional(),
  contact_phone:                   z.string().optional(),
  anticipated_annual_revenue:      z.string().optional(),
  accepts_card_or_online_payments: z.boolean().optional(),
  will_have_employees:             z.boolean().optional(),
  personal_tax_notes:              z.string().optional(),
  addons: z.object({
    ein:             z.boolean().optional(),
    s_corp_election: z.boolean().optional(),
    expedited:       z.boolean().optional(),
    boi_report:      z.boolean().optional(),
  }).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (isMockMode()) {
    const order = mockStore.getOrder(id)
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(order)
  }

  try {
    const { createServiceClient } = await import('@/lib/insforge/server')
    const insforge = createServiceClient()

    const { data, error } = await insforge.database
      .from('formation.orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/orders/:id]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const d = parsed.data

    // ── Mock mode ────────────────────────────────────────────────────────────
    if (isMockMode()) {
      const order = mockStore.getOrder(id)
      if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const updates: Record<string, unknown> = { ...d }
      if (d.addons) updates.addons = { ...(order.addons ?? {}), ...d.addons }
      mockStore.updateOrder(id, updates)
      return NextResponse.json({ ok: true })
    }

    // ── Insforge ─────────────────────────────────────────────────────────────
    const { createServiceClient } = await import('@/lib/insforge/server')
    const insforge = createServiceClient()

    const { data: existing, error: fetchError } = await insforge.database
      .from('formation.orders')
      .select('status, addons')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['draft', 'pending_payment'].includes(existing.status)) {
      return NextResponse.json({ error: 'Order can no longer be edited' }, { status: 409 })
    }

    // Build update object with only fields that were provided
    const updates: Record<string, unknown> = {}
    if (d.business_name_choice_1          !== undefined) updates.business_name_choice_1          = d.business_name_choice_1
    if (d.business_name_choice_2          !== undefined) updates.business_name_choice_2          = d.business_name_choice_2
    if (d.entity_type                     !== undefined) updates.entity_type                     = d.entity_type
    if (d.formation_state                 !== undefined) updates.formation_state                 = d.formation_state
    if (d.business_description            !== undefined) updates.business_description            = d.business_description
    if (d.business_address                !== undefined) updates.business_address                = d.business_address
    if (d.anticipated_start_date          !== undefined) updates.anticipated_start_date          = d.anticipated_start_date
    if (d.contact_email                   !== undefined) updates.contact_email                   = d.contact_email
    if (d.contact_phone                   !== undefined) updates.contact_phone                   = d.contact_phone
    if (d.anticipated_annual_revenue      !== undefined) updates.anticipated_annual_revenue      = d.anticipated_annual_revenue
    if (d.accepts_card_or_online_payments !== undefined) updates.accepts_card_or_online_payments = d.accepts_card_or_online_payments
    if (d.will_have_employees             !== undefined) updates.will_have_employees             = d.will_have_employees
    if (d.personal_tax_notes              !== undefined) updates.personal_tax_notes              = d.personal_tax_notes
    // Merge addons rather than replace
    if (d.addons !== undefined) {
      updates.addons = { ...(existing.addons ?? {}), ...d.addons }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await insforge.database
        .from('formation.orders')
        .update(updates)
        .eq('id', id)
      if (updateError) throw updateError
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/orders/:id]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
