/**
 * GET /api/orders/:id/status
 *
 * No-auth, token-based status check. The id here is the order ID and must
 * be accompanied by ?token=<status_token> to prevent order enumeration.
 * Used by the client-facing /status/:token page via the server component,
 * and optionally by the client if polling is needed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge/server'

type RouteContext = { params: { id: string } }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  try {
    const insforge = createServiceClient()
    const { data, error } = await insforge.database
      .from('formation.orders')
      .select('status, business_name_choice_1')
      .eq('id', params.id)
      .eq('status_token', token)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      status:        data.status,
      business_name: data.business_name_choice_1,
    })
  } catch (err) {
    console.error('[GET /api/orders/:id/status]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
