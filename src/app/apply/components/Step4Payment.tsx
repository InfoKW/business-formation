'use client'

import { useEffect, useState } from 'react'
import type { PriceBreakdown } from '@/types'

interface Props {
  orderId: string
  onBack: () => void
}

export default function Step4Payment({ orderId, onBack }: Props) {
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)

  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

  // Pre-load the checkout session so the button is instant
  useEffect(() => {
    async function loadCheckout() {
      setLoading(true)
      try {
        const res = await fetch(`/api/orders/${orderId}/create-checkout-session`, {
          method: 'POST',
        })
        if (!res.ok) {
          const { error } = await res.json()
          throw new Error(error ?? 'Failed to initialize checkout')
        }
        const { url, breakdown: bd } = await res.json()
        setCheckoutUrl(url)
        setBreakdown(bd)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load checkout')
      } finally {
        setLoading(false)
      }
    }
    loadCheckout()
  }, [orderId])

  function handleProceed() {
    if (!checkoutUrl) return
    setRedirecting(true)
    window.location.href = checkoutUrl
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-kw-forest font-normal mb-1">Review & Pay</h2>
        <p className="text-kw-text-secondary text-sm">
          Confirm your order summary below, then proceed to secure payment powered by Stripe.
        </p>
      </div>

      {/* Order summary */}
      {breakdown && (
        <div className="bg-kw-forest text-white rounded-card p-5 space-y-3">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-kw-gold-light mb-3">
            Order Summary
          </h3>
          {breakdown.line_items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-white/80">{item.label}</span>
              <span className="font-semibold text-white">{fmt(item.cents)}</span>
            </div>
          ))}
          <div className="border-t border-white/20 pt-3 flex justify-between font-bold">
            <span className="text-kw-gold-light">Total Due Today</span>
            <span className="text-kw-gold text-lg">{fmt(breakdown.total_cents)}</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 text-kw-text-muted text-sm">
          Preparing your order...
        </div>
      )}

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-card p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {checkoutUrl && !loadError && (
        <>
          <button
            type="button"
            onClick={handleProceed}
            disabled={redirecting}
            className="btn-gold w-full justify-center"
          >
            {redirecting ? 'Redirecting to Stripe...' : 'Proceed to Secure Payment →'}
          </button>

          <p className="text-center text-[12px] text-kw-text-muted">
            You will be redirected to Stripe&apos;s secure checkout. KelliWorks does not store your card details.
          </p>
        </>
      )}

      <button type="button" onClick={onBack} className="btn-forest w-full justify-center">
        &larr; Back to Financial Information
      </button>
    </div>
  )
}
