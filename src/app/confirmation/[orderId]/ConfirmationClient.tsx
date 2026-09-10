'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import KWHeader from '@/components/KWHeader'
import Link from 'next/link'

type PageState = 'loading' | 'success' | 'invalid'

interface Props { orderId: string }

export default function ConfirmationClient({ orderId }: Props) {
  const searchParams = useSearchParams()
  const [pageState, setPageState] = useState<PageState>('loading')

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const isMock    = searchParams.get('mock') === 'true'

    if (sessionId || isMock) {
      // Stripe redirected here after successful Checkout — payment is confirmed
      setPageState('success')
      try { sessionStorage.removeItem('kw_formation_state') } catch {}
    } else {
      // Direct navigation without a valid Stripe redirect
      setPageState('invalid')
    }
  }, [searchParams])

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kw-cream text-kw-text-muted text-sm">
        Confirming your payment...
      </div>
    )
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen flex flex-col bg-kw-cream">
        <KWHeader />
        <main className="flex-1 flex items-start justify-center px-4 py-16">
          <div className="max-w-lg w-full bg-white border border-red-200 rounded-card p-8 text-center">
            <div className="text-4xl mb-4">&#10060;</div>
            <h1 className="font-display text-2xl text-kw-forest mb-3">No payment found</h1>
            <p className="text-kw-text-secondary text-sm mb-6">
              We could not find a completed payment for this order. If you just paid, please wait a
              moment and refresh — or contact us if the issue persists.
            </p>
            <Link href="/apply" className="btn-gold">Start a New Order</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-kw-cream">
      <KWHeader />

      <main className="flex-1 flex items-start justify-center px-4 py-16">
        <div className="max-w-lg w-full">

          {/* Success card */}
          <div className="bg-kw-forest text-white rounded-card p-8 text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-kw-gold/20 flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M5 14l6 6L23 7" stroke="#C3A862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-kw-gold-light mb-3">
              Order Confirmed
            </p>
            <h1 className="font-display text-3xl font-normal text-white mb-4">
              Payment Received
            </h1>
            <p className="text-white/75 text-[15px] leading-relaxed">
              Thank you — your payment has been received and your formation order has been submitted for processing.
            </p>
          </div>

          {/* What happens next */}
          <div className="bg-white border border-kw-border-light rounded-card p-6 space-y-4 mb-6">
            <h2 className="font-semibold text-kw-forest text-[15px]">What happens next</h2>
            <div className="space-y-3 text-sm text-kw-text-secondary">
              {[
                'KelliWorks submits your formation order to our filing partner (Northwest Registered Agent).',
                'Our filing partner places your order in queue for the relevant state — standard timelines vary by state; select expedited filing for faster processing.',
                "You'll receive an email confirmation at each stage. Once your entity is officially formed, we'll notify you with next steps.",
              ].map((s, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-kw-gold/20 text-kw-gold-dark text-[11px] font-bold flex-shrink-0 flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p>{s}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Important note */}
          <div className="border-l-4 border-kw-gold bg-kw-gold/5 px-5 py-4 rounded-r-card text-sm text-kw-text-secondary mb-6">
            <strong className="text-kw-forest">Please note:</strong> Submitting your order and payment today starts
            the process — it does not mean your business entity exists yet. Formation timelines depend on your state.
          </div>

          <div className="text-center">
            <p className="text-[13px] text-kw-text-muted mb-4">
              Order reference: <code className="bg-kw-bg-secondary px-2 py-0.5 rounded text-[12px]">{orderId}</code>
            </p>
            <p className="text-sm text-kw-text-secondary">
              Questions? Call{' '}
              <a href="tel:8888754555" className="text-kw-gold-dark underline font-medium">888-875-4555</a>
              {' '}or email{' '}
              <a href="mailto:info@kelliworks.com" className="text-kw-gold-dark underline font-medium">info@kelliworks.com</a>
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-kw-forest text-center py-4 text-[12px] text-white/40">
        &copy; 2026 KelliWorks. All rights reserved.
      </footer>
    </div>
  )
}
