/**
 * GET /api/admin/orders - list/filter orders (auth-protected via middleware)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge/server'

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status')
  const page   = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10)
  const limit  = 50
  const from   = (page - 1) * limit
  const to     = from + limit - 1

  try {
    const insforge = createServiceClient()

    let query = insforge.database
      .from('formation.orders')
      .select('id, status, business_name_choice_1, entity_type, formation_state, contact_email, price_cents, created_at, updated_at, nwra_error_message')
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (status) query = query.eq('status', status)

    const { data: orders, error } = await query
    if (error) throw error

    return NextResponse.json({ orders: orders ?? [] })
  } catch (err) {
    console.error('[GET /api/admin/orders]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
