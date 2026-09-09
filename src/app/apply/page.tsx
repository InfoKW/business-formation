'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import KWHeader from '@/components/KWHeader'
import StepIndicator from '@/components/StepIndicator'
import Step1Business from './components/Step1Business'
import Step2Owners from './components/Step2Owners'
import Step3Financial from './components/Step3Financial'
import Step4Payment from './components/Step4Payment'
import type { FormState, Step1Data, Step2Data, Step3Data } from '@/types'

const BLANK_STEP1: Step1Data = {
  business_name_choice_1: '',
  business_name_choice_2: '',
  entity_type: '',
  formation_state: '',
  business_description: '',
  business_address: '',
  anticipated_start_date: '',
  contact_email: '',
  contact_phone: '',
}

const BLANK_STEP2: Step2Data = { owners: [] }

const BLANK_STEP3: Step3Data = {
  anticipated_annual_revenue: '',
  accepts_card_or_online_payments: null,
  will_have_employees: null,
  personal_tax_notes: '',
  addons: { ein: false, s_corp_election: false, expedited: false, boi_report: false },
}

const SESSION_KEY = 'kw_formation_state'

export default function ApplyPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const [formState, setFormState] = useState<FormState>({
    orderId: null,
    step1: { ...BLANK_STEP1 },
    step2: { ...BLANK_STEP2 },
    step3: { ...BLANK_STEP3 },
  })

  // Rehydrate from sessionStorage (simple resume support)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as FormState
        setFormState(parsed)
        // Don't restore step > 3 (payment step - user must re-confirm)
      }
    } catch {}
  }, [])

  // Persist to sessionStorage on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(formState))
    } catch {}
  }, [formState])

  // ── Step 1 → Step 2: create draft order ────────────────────────────────────
  async function handleStep1Next() {
    setLoading(true)
    setApiError(null)
    try {
      let orderId = formState.orderId

      if (!orderId) {
        // Create new order
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formState.step1),
        })
        if (!res.ok) {
          const body = await res.json()
          throw new Error(body.error ?? 'Failed to save your information. Please try again.')
        }
        const { id } = await res.json()
        orderId = id
        setFormState((s) => ({ ...s, orderId }))
      } else {
        // Update existing order
        const res = await fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formState.step1),
        })
        if (res.status === 404) {
          // Stale orderId (e.g. server restarted and wiped mock store) - create fresh
          setFormState((s) => ({ ...s, orderId: null }))
          try { sessionStorage.removeItem(SESSION_KEY) } catch {}
          const createRes = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formState.step1),
          })
          if (!createRes.ok) {
            const body = await createRes.json()
            throw new Error(body.error ?? 'Failed to save your information.')
          }
          const { id } = await createRes.json()
          orderId = id
          setFormState((s) => ({ ...s, orderId: id }))
        } else if (!res.ok) {
          const body = await res.json()
          throw new Error(body.error ?? 'Failed to save your information.')
        }
      }

      setStep(2)
      window.scrollTo(0, 0)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2 → Step 3: save owners ───────────────────────────────────────────
  async function handleStep2Next() {
    setLoading(true)
    setApiError(null)
    const { orderId, step2 } = formState
    if (!orderId) { setApiError('Order not found. Please go back to step 1.'); setLoading(false); return }

    try {
      // Delete existing owners and re-POST (simple upsert strategy)
      const res = await fetch(`/api/orders/${orderId}/owners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owners: step2.owners }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to save owner information.')
      }
      setStep(3)
      window.scrollTo(0, 0)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3 → Step 4: save financial info ───────────────────────────────────
  async function handleStep3Next() {
    setLoading(true)
    setApiError(null)
    const { orderId, step3 } = formState
    if (!orderId) { setApiError('Order not found.'); setLoading(false); return }

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anticipated_annual_revenue: step3.anticipated_annual_revenue,
          accepts_card_or_online_payments: step3.accepts_card_or_online_payments,
          will_have_employees: step3.will_have_employees,
          personal_tax_notes: step3.personal_tax_notes,
          addons: step3.addons,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to save financial information.')
      }
      setStep(4)
      window.scrollTo(0, 0)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function back() {
    setApiError(null)
    setStep((s) => Math.max(1, s - 1))
    window.scrollTo(0, 0)
  }

  return (
    <div className="min-h-screen flex flex-col bg-kw-cream">
      <KWHeader />

      <main className="flex-1 px-4 py-10 sm:py-14">
        <div className="max-w-2xl mx-auto">
          <StepIndicator current={step} />

          {/* API-level error (not validation errors - those live in the step components) */}
          {apiError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-card p-4 text-sm text-red-700">
              {apiError}
            </div>
          )}

          <div className="bg-white rounded-card border border-kw-border-light shadow-hover p-6 sm:p-8">
            {step === 1 && (
              <Step1Business
                data={formState.step1}
                onChange={(d) => setFormState((s) => ({ ...s, step1: d }))}
                onNext={handleStep1Next}
                loading={loading}
              />
            )}
            {step === 2 && (
              <Step2Owners
                data={formState.step2}
                onChange={(d) => setFormState((s) => ({ ...s, step2: d }))}
                onNext={handleStep2Next}
                onBack={back}
                loading={loading}
              />
            )}
            {step === 3 && (
              <Step3Financial
                data={formState.step3}
                onChange={(d) => setFormState((s) => ({ ...s, step3: d }))}
                onNext={handleStep3Next}
                onBack={back}
                loading={loading}
              />
            )}
            {step === 4 && formState.orderId && (
              <Step4Payment
                orderId={formState.orderId}
                onBack={back}
              />
            )}
          </div>

          <p className="mt-6 text-center text-[12px] text-kw-text-muted">
            Need help?{' '}
            <a href="tel:8888754555" className="text-kw-gold-dark underline">888-875-4555</a>
            {' '}·{' '}
            <a href="mailto:info@kelliworks.com" className="text-kw-gold-dark underline">info@kelliworks.com</a>
          </p>
        </div>
      </main>

      <footer className="bg-kw-forest text-center py-4 text-[12px] text-white/40">
        &copy; 2026 KelliWorks. All rights reserved.
      </footer>
    </div>
  )
}
