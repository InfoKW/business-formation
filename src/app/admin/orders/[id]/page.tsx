/**
 * Admin - order detail view with audit trail and action buttons.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/insforge/server'
import type { Order, OrderOwner, OrderEvent } from '@/types'
import AdminOrderActions from './AdminOrderActions'

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const insforge = createServiceClient()

  const [
    { data: order },
    { data: owners },
    { data: events },
  ] = await Promise.all([
    insforge.database
      .from('formation.orders')
      .select('*')
      .eq('id', id)
      .maybeSingle() as Promise<{ data: Order | null }>,
    insforge.database
      .from('formation.order_owners')
      .select('id, first_name, last_name, ownership_percentage, citizenship_status, email, phone, ssn_last4, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true }) as Promise<{ data: OrderOwner[] | null }>,
    insforge.database
      .from('formation.order_events')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: false }) as Promise<{ data: OrderEvent[] | null }>,
  ])

  if (!order) notFound()

  const fmt = (cents: number | null) =>
    cents != null
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
      : '-'

  const STATUS_BADGE: Record<string, string> = {
    draft:             'bg-gray-100 text-gray-600',
    pending_payment:   'bg-amber-100 text-amber-700',
    payment_confirmed: 'bg-blue-100 text-blue-700',
    filed_with_nwra:   'bg-green-100 text-green-700',
    nwra_error:        'bg-red-100 text-red-700 font-bold',
    complete:          'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="min-h-screen bg-kw-bg-secondary">
      <header className="bg-kw-forest text-white px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-white/60 hover:text-white text-sm">&larr; All Orders</Link>
          <span className="text-white/30">/</span>
          <span className="text-sm text-white/80 truncate">{order.business_name_choice_1 ?? order.id}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-kw-forest">{order.business_name_choice_1 ?? 'Unnamed Order'}</h1>
            <p className="text-sm text-kw-text-muted mt-0.5">ID: <code className="bg-kw-bg-secondary px-1 py-0.5 rounded text-xs">{order.id}</code></p>
          </div>
          <span className={`text-[12px] px-3 py-1.5 rounded-pill ${STATUS_BADGE[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* NWRA error alert */}
        {order.status === 'nwra_error' && (
          <div className="bg-red-50 border border-red-300 rounded-card p-5">
            <p className="font-bold text-red-700 mb-1">NWRA Submission Failed - Action Required</p>
            <p className="text-sm text-red-600 mb-3">{order.nwra_error_message}</p>
            <p className="text-xs text-red-500">
              The client has already paid. Use the actions below to retry or manually resolve.
            </p>
          </div>
        )}

        {/* Actions */}
        {(order.status === 'nwra_error' || order.status === 'filed_with_nwra' || order.status === 'complete') && (
          <AdminOrderActions orderId={order.id} status={order.status} />
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Order Details */}
          <div className="bg-white border border-kw-border-light rounded-card p-6">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-kw-text-muted mb-4">Order Details</h2>
            <dl className="space-y-3 text-sm">
              {[
                ['Business Name (1st)', order.business_name_choice_1],
                ['Business Name (2nd)', order.business_name_choice_2],
                ['Entity Type', order.entity_type],
                ['Formation State', order.formation_state],
                ['Business Address', order.business_address],
                ['Start Date', order.anticipated_start_date],
                ['Revenue', order.anticipated_annual_revenue],
                ['Card Payments', order.accepts_card_or_online_payments != null ? (order.accepts_card_or_online_payments ? 'Yes' : 'No') : null],
                ['Will Have Employees', order.will_have_employees != null ? (order.will_have_employees ? 'Yes' : 'No') : null],
                ['Amount', fmt(order.price_cents)],
                ['Stripe PI', order.stripe_payment_intent_id],
                ['NWRA Company ID', order.nwra_company_id],
                ['NWRA Order ID', order.nwra_order_id],
                ['NWRA Status', order.nwra_last_synced_status],
                ['Contact Email', order.contact_email],
                ['Contact Phone', order.contact_phone],
              ].filter(([, v]) => v != null).map(([label, value]) => (
                <div key={String(label)} className="flex gap-2">
                  <dt className="text-kw-text-muted w-40 flex-shrink-0">{label}</dt>
                  <dd className="font-medium text-kw-forest break-all">{String(value)}</dd>
                </div>
              ))}
            </dl>
            {order.personal_tax_notes && (
              <div className="mt-4 pt-4 border-t border-kw-border-light">
                <p className="text-[12px] font-bold uppercase tracking-widest text-kw-text-muted mb-1">Tax Notes</p>
                <p className="text-sm text-kw-text-secondary">{order.personal_tax_notes}</p>
              </div>
            )}
            {order.addons && (
              <div className="mt-4 pt-4 border-t border-kw-border-light">
                <p className="text-[12px] font-bold uppercase tracking-widest text-kw-text-muted mb-2">Add-Ons</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(order.addons).filter(([, v]) => v).map(([k]) => (
                    <span key={k} className="text-[11px] bg-kw-gold/20 text-kw-gold-dark px-2 py-0.5 rounded-pill font-semibold">
                      {k.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {!Object.values(order.addons).some(Boolean) && (
                    <span className="text-sm text-kw-text-muted">None selected</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Owners */}
          <div className="bg-white border border-kw-border-light rounded-card p-6">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-kw-text-muted mb-4">Owners / Members</h2>
            {(owners ?? []).length === 0 ? (
              <p className="text-sm text-kw-text-muted">No owners recorded.</p>
            ) : (
              <div className="space-y-4">
                {(owners ?? []).map((o) => (
                  <div key={o.id} className="border-b border-kw-border-light pb-4 last:border-0 last:pb-0 text-sm space-y-1">
                    <p className="font-semibold text-kw-forest">{[o.first_name, o.last_name].filter(Boolean).join(' ')}</p>
                    <p className="text-kw-text-muted">Ownership: {o.ownership_percentage ?? '-'}%</p>
                    <p className="text-kw-text-muted">SSN last 4: {o.ssn_last4 ?? '-'}</p>
                    <p className="text-kw-text-muted">{o.citizenship_status ?? ''}</p>
                    <p className="text-kw-text-muted">{o.email} · {o.phone}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Audit log */}
        <div className="bg-white border border-kw-border-light rounded-card p-6">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-kw-text-muted mb-4">Audit Log</h2>
          {(events ?? []).length === 0 ? (
            <p className="text-sm text-kw-text-muted">No events recorded.</p>
          ) : (
            <div className="space-y-2">
              {(events ?? []).map((ev) => (
                <div key={ev.id} className="flex gap-4 text-sm border-b border-kw-border-light py-2.5 last:border-0">
                  <span className="text-kw-text-muted text-[11px] w-40 flex-shrink-0 pt-0.5">
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium text-kw-forest">{ev.event_type.replace(/_/g, ' ')}</span>
                    {ev.detail && Object.keys(ev.detail).length > 0 && (
                      <pre className="mt-1 text-[11px] text-kw-text-muted bg-kw-bg-secondary p-2 rounded overflow-x-auto">
                        {JSON.stringify(ev.detail, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
