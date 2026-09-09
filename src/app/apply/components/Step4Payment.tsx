'use client'

import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import type { PriceBreakdown } from '@/types'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// ── Inner payment form (must be inside <Elements>) ────────────────────────────

interface PayFormProps {
  orderId: string
  onSuccess: () => void
}

function PaymentForm({ orderId, onSuccess }: PayFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setPaying(true)
    setError(null)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${appUrl}/confirmation/${orderId}`,
      },
    })

    // If we reach here, confirmPayment failed immediately (redirect didn't happen)
    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
    }
    setPaying(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white border border-kw-border-light rounded-card p-5">
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-card p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || paying}
        className="btn-gold w-full justify-center"
      >
        {paying ? 'Processing...' : 'Pay & Submit Order'}
      </button>

      <p className="text-center text-[12px] text-kw-text-muted">
        Payments are processed securely by Stripe. KelliWorks does not store your card details.
      </p>
    </form>
  )
}

// ── Outer step wrapper ─────────────────────────────────────────────────────────

interface Props {
  orderId: string
  onBack: () => void
}

export default function Step4Payment({ orderId, onBack }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMock, setIsMock] = useState(false)

  useEffect(() => {
    async function createIntent() {
      setLoading(true)
      try {
        const res = await fetch(`/api/orders/${orderId}/create-payment-intent`, {
          method: 'POST',
        })
        if (!res.ok) {
          const { error } = await res.json()
          throw new Error(error ?? 'Failed to initialize payment')
        }
        const { clientSecret: cs, breakdown: bd } = await res.json()
        setClientSecret(cs)
        setBreakdown(bd)
        setIsMock(cs?.startsWith('mock_secret_') ?? false)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load payment form')
      } finally {
        setLoading(false)
      }
    }
    createIntent()
  }, [orderId])

  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-kw-forest font-normal mb-1">Payment</h2>
        <p className="text-kw-text-secondary text-sm">
          Review your order summary, then complete payment to submit your formation.
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
            <span className="text-kw-gold-light">Total</span>
            <span className="text-kw-gold text-lg">{fmt(breakdown.total_cents)}</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-kw-text-muted text-sm">
          Loading payment form...
        </div>
      )}

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-card p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {clientSecret && isMock && (
        <div className="bg-amber-50 border-2 border-amber-300 border-dashed rounded-card p-6 text-center space-y-2">
          <p className="font-bold text-amber-800 text-sm">Mock Mode - Payment Skipped</p>
          <p className="text-amber-700 text-[13px]">
            Running locally without Stripe keys. The order summary above is real.<br />
            Add your Stripe test keys to <code className="bg-amber-100 px-1 rounded">.env.local</code> to enable the payment form.
          </p>
        </div>
      )}

      {clientSecret && !isMock && (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'flat',
              variables: {
                colorPrimary: '#C3A862',
                colorBackground: '#ffffff',
                colorText: '#1A1A1A',
                colorDanger: '#df1b41',
                fontFamily: '"Source Sans 3", Arial, sans-serif',
                borderRadius: '8px',
              },
            },
          }}
        >
          <PaymentForm orderId={orderId} onSuccess={() => {}} />
        </Elements>
      )}

      <button type="button" onClick={onBack} className="btn-forest w-full justify-center">
        &larr; Back to Financial Information
      </button>
    </div>
  )
}
