/**
 * Admin - order list with status filter.
 * Auth is handled in middleware.ts (HTTP Basic Auth).
 */
import Link from 'next/link'
import { isMockMode, mockStore } from '@/lib/mock-store'
import type { Order } from '@/types'

const STATUS_OPTIONS = [
  { value: '', label: 'All Orders' },
  { value: 'nwra_error', label: 'Errors (Action Required)' },
  { value: 'payment_confirmed', label: 'Pending NWRA Submission' },
  { value: 'filed_with_nwra', label: 'Filed with NWRA' },
  { value: 'complete', label: 'Complete' },
  { value: 'pending_payment', label: 'Awaiting Payment' },
  { value: 'draft', label: 'Draft' },
]

const STATUS_BADGE: Record<string, string> = {
  draft:             'bg-gray-100 text-gray-600',
  pending_payment:   'bg-amber-100 text-amber-700',
  payment_confirmed: 'bg-blue-100 text-blue-700',
  filed_with_nwra:   'bg-green-100 text-green-700',
  nwra_error:        'bg-red-100 text-red-700',
  complete:          'bg-emerald-100 text-emerald-700',
}

async function fetchOrders(statusFilter: string, page: number): Promise<Order[]> {
  const perPage = 50
  const offset = (page - 1) * perPage

  if (isMockMode()) {
    const all = mockStore.getAllOrders()
    const filtered = statusFilter ? all.filter((o) => o.status === statusFilter) : all
    return filtered.slice(offset, offset + perPage) as unknown as Order[]
  }

  const { createServiceClient } = await import('@/lib/insforge/server')
  const insforge = createServiceClient()

  let query = insforge.database
    .from('formation.orders')
    .select('id, status, business_name_choice_1, entity_type, formation_state, contact_email, price_cents, created_at, updated_at, nwra_error_message')
    .order('updated_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Order[]
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const params = await searchParams
  const statusFilter = params.status ?? ''
  const page = parseInt(params.page ?? '1', 10)
  const perPage = 50

  let orders: Order[] = []
  let fetchError: string | null = null
  try {
    orders = await fetchOrders(statusFilter, page)
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Failed to load orders'
  }

  const fmt = (cents: number | null) =>
    cents != null
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
      : '-'

  return (
    <div className="min-h-screen bg-kw-bg-secondary">
      <header className="bg-kw-forest text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="font-display text-lg text-kw-gold">KelliWorks Admin</span>
          <span className="text-[11px] uppercase tracking-widest text-white/50">Formation Portal</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-xl font-bold text-kw-forest">Orders</h1>

          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={opt.value ? `/admin?status=${opt.value}` : '/admin'}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-pill border transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-kw-forest text-white border-kw-forest'
                    : 'bg-white text-kw-text-secondary border-kw-border-mid hover:border-kw-forest'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>

        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-card p-4 text-sm text-red-700 mb-6">
            {fetchError}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-card border border-kw-border-light p-12 text-center text-kw-text-muted text-sm">
            No orders found.
          </div>
        ) : (
          <div className="bg-white rounded-card border border-kw-border-light overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-kw-bg-secondary border-b border-kw-border-light">
                <tr>
                  {['Business Name', 'Type', 'State', 'Email', 'Amount', 'Status', 'Updated', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-kw-text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-kw-border-light hover:bg-kw-cream/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-kw-forest">{o.business_name_choice_1 ?? '-'}</span>
                      {o.nwra_error_message && (
                        <p className="text-[11px] text-red-500 mt-0.5 truncate max-w-[200px]">{o.nwra_error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-kw-text-secondary">{o.entity_type ?? '-'}</td>
                    <td className="px-4 py-3 text-kw-text-secondary">{o.formation_state ?? '-'}</td>
                    <td className="px-4 py-3 text-kw-text-secondary">{o.contact_email}</td>
                    <td className="px-4 py-3 font-medium">{fmt(o.price_cents)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-pill ${STATUS_BADGE[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {o.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-kw-text-muted text-[12px]">
                      {new Date(o.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="text-kw-gold-dark text-[12px] font-semibold hover:underline">
                        View &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex justify-between mt-4 text-sm">
          {page > 1 ? (
            <Link href={`/admin?${statusFilter ? `status=${statusFilter}&` : ''}page=${page - 1}`} className="text-kw-gold-dark underline">
              &larr; Previous
            </Link>
          ) : <span />}
          {orders.length === perPage ? (
            <Link href={`/admin?${statusFilter ? `status=${statusFilter}&` : ''}page=${page + 1}`} className="text-kw-gold-dark underline">
              Next &rarr;
            </Link>
          ) : <span />}
        </div>
      </main>
    </div>
  )
}
