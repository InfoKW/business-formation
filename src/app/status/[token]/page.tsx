/**
 * No-auth client-facing status page - linked from confirmation emails.
 * Accessed via /status/:status_token (not order ID - prevents enumeration).
 */
import { notFound } from 'next/navigation'
import { isMockMode, mockStore } from '@/lib/mock-store'
import KWHeader from '@/components/KWHeader'
import type { Order } from '@/types'

const STATUS_LABELS: Record<string, { label: string; description: string; color: string }> = {
  draft:             { label: 'Draft',              description: 'Your order is still in progress.',                                   color: 'text-kw-text-muted' },
  pending_payment:   { label: 'Awaiting Payment',   description: 'Your order is waiting for payment confirmation.',                    color: 'text-amber-600' },
  payment_confirmed: { label: 'Payment Confirmed',  description: 'Payment received. Your order is being submitted for processing.',    color: 'text-kw-forest' },
  filed_with_nwra:   { label: 'Submitted for Processing', description: 'Your formation order has been submitted. Processing timelines vary by state.', color: 'text-kw-forest' },
  nwra_error:        { label: 'Under Review',       description: 'Our team is reviewing your order. We\'ll be in touch shortly.',     color: 'text-amber-600' },
  complete:          { label: 'Formation Complete', description: 'Your business entity has been officially formed.',                   color: 'text-green-700' },
}

async function findOrderByToken(token: string): Promise<Order | null> {
  if (isMockMode()) {
    const all = mockStore.getAllOrders()
    const match = all.find((o) => o.status_token === token)
    return match ? (match as unknown as Order) : null
  }

  const { createServiceClient } = await import('@/lib/insforge/server')
  const insforge = createServiceClient()

  const { data, error } = await insforge.database
    .from('formation.orders')
    .select('id, status, status_token, business_name_choice_1, entity_type, formation_state, contact_email, created_at')
    .eq('status_token', token)
    .maybeSingle()

  if (error) throw error
  return data as Order | null
}

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const order = await findOrderByToken(token)
  if (!order) notFound()

  const info = STATUS_LABELS[order.status] ?? STATUS_LABELS.draft

  return (
    <div className="min-h-screen flex flex-col bg-kw-cream">
      <KWHeader />
      <main className="flex-1 px-4 py-16 flex items-start justify-center">
        <div className="max-w-lg w-full">
          <div className="bg-white border border-kw-border-light rounded-card p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-kw-gold mb-1">Order Status</p>
            <h1 className="font-display text-2xl text-kw-forest font-normal mb-6">
              {order.business_name_choice_1 ?? 'Your Formation Order'}
            </h1>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-3 h-3 rounded-full bg-kw-gold flex-shrink-0" />
              <div>
                <p className={`font-bold text-[15px] ${info.color}`}>{info.label}</p>
                <p className="text-sm text-kw-text-secondary mt-0.5">{info.description}</p>
              </div>
            </div>

            <div className="border-t border-kw-border-light pt-5 space-y-2 text-sm">
              {order.entity_type && (
                <div className="flex justify-between">
                  <span className="text-kw-text-muted">Entity type</span>
                  <span className="font-medium text-kw-text-primary">{order.entity_type}</span>
                </div>
              )}
              {order.formation_state && (
                <div className="flex justify-between">
                  <span className="text-kw-text-muted">State</span>
                  <span className="font-medium text-kw-text-primary">{order.formation_state}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-kw-text-muted">Order placed</span>
                <span className="font-medium text-kw-text-primary">
                  {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-kw-text-secondary">
            Questions?{' '}
            <a href="tel:8888754555" className="text-kw-gold-dark underline font-medium">888-875-4555</a>
            {' '}·{' '}
            <a href="mailto:info@kelliworks.com" className="text-kw-gold-dark underline font-medium">info@kelliworks.com</a>
          </p>
        </div>
      </main>
      <footer className="bg-kw-forest text-center py-4 text-[12px] text-white/40">
        &copy; 2026 KelliWorks. All rights reserved.
      </footer>
    </div>
  )
}
