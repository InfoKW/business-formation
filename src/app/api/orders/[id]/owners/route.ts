/**
 * POST /api/orders/:id/owners
 * Replace all owners for an order (idempotent).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isMockMode, mockStore } from '@/lib/mock-store'
import { randomUUID } from 'crypto'

const ownerSchema = z.object({
  first_name:           z.string().min(1, 'First name is required'),
  middle_name:          z.string().optional(),
  last_name:            z.string().min(1, 'Last name is required'),
  date_of_birth:        z.string().min(1, 'Date of birth is required'),
  ownership_percentage: z.coerce.number({ invalid_type_error: 'Ownership % must be a number' }).min(0.01, 'Ownership % must be greater than 0').max(100, 'Ownership % cannot exceed 100'),
  ssn_full:             z.string().regex(/^\d{3}-?\d{2}-?\d{4}$/, 'SSN must be in format XXX-XX-XXXX'),
  citizenship_status:   z.enum(['US Citizen', 'Permanent Resident', 'Other'], { errorMap: () => ({ message: 'Citizenship status is required' }) }),
  mailing_address:      z.string().min(1, 'Mailing address is required'),
  personal_address:     z.string().optional(),
  phone:                z.string().min(1, 'Phone is required'),
  email:                z.string().email('Enter a valid email address'),
})

const schema = z.object({
  owners: z.array(ownerSchema).min(1),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const ownerIndex = typeof issue?.path[0] === 'number' ? issue.path[0] : null
      const field = issue?.path.slice(1).join('.') ?? issue?.path.join('.') ?? 'unknown field'
      const prefix = ownerIndex !== null ? `Owner ${ownerIndex + 1} - ${field}: ` : ''
      return NextResponse.json({ error: `${prefix}${issue?.message ?? 'Invalid input'}` }, { status: 400 })
    }

    const { owners } = parsed.data

    // ── Mock mode ────────────────────────────────────────────────────────────
    if (isMockMode()) {
      const order = mockStore.getOrder(id)
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

      const mockOwners = owners.map((o) => ({
        id: randomUUID(),
        order_id: id,
        first_name: o.first_name,
        last_name: o.last_name,
        ownership_percentage: o.ownership_percentage,
        ssn_last4: o.ssn_full.replace(/\D/g, '').slice(-4),
        email: o.email,
        phone: o.phone,
      }))
      mockStore.setOwners(id, mockOwners)
      return NextResponse.json({ ok: true, count: mockOwners.length })
    }

    // ── Insforge ─────────────────────────────────────────────────────────────
    const { createServiceClient } = await import('@/lib/insforge/server')
    const { encrypt, ssnLast4 } = await import('@/lib/crypto')
    const insforge = createServiceClient()

    const { data: existing, error: fetchError } = await insforge.database
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (!['draft', 'pending_payment'].includes(existing.status)) {
      return NextResponse.json({ error: 'Order is no longer editable' }, { status: 409 })
    }

    // Delete existing owners then re-insert (idempotent)
    const { error: deleteError } = await insforge.database
      .from('order_owners')
      .delete()
      .eq('order_id', id)
    if (deleteError) throw deleteError

    const ownerRows = owners.map((o) => {
      const rawDigits = o.ssn_full.replace(/\D/g, '')
      return {
        order_id:             id,
        first_name:           o.first_name,
        middle_name:          o.middle_name ?? null,
        last_name:            o.last_name,
        date_of_birth:        o.date_of_birth,
        ownership_percentage: o.ownership_percentage,
        ssn_last4:            ssnLast4(rawDigits),
        ssn_encrypted:        encrypt(rawDigits),
        citizenship_status:   o.citizenship_status,
        mailing_address:      o.mailing_address,
        personal_address:     o.personal_address ?? null,
        phone:                o.phone,
        email:                o.email,
      }
    })

    const { error: insertError } = await insforge.database
      .from('order_owners')
      .insert(ownerRows)
    if (insertError) throw insertError

    return NextResponse.json({ ok: true, count: owners.length })
  } catch (err) {
    console.error('[POST /api/orders/:id/owners]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
