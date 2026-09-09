'use client'

import { useState } from 'react'
import FormField from '@/components/FormField'
import type { Step3Data, OrderAddons } from '@/types'

const REVENUE_OPTIONS = [
  'Under $50,000',
  '$50,000 – $100,000',
  '$100,000 – $250,000',
  '$250,000 – $500,000',
  '$500,000 – $1,000,000',
  'Over $1,000,000',
  'Not sure yet',
]

type Errors = Partial<Record<'anticipated_annual_revenue' | 'accepts_card_or_online_payments' | 'will_have_employees', string>>

function validate(d: Step3Data): Errors {
  const e: Errors = {}
  if (!d.anticipated_annual_revenue) e.anticipated_annual_revenue = 'Please select an option'
  if (d.accepts_card_or_online_payments === null) e.accepts_card_or_online_payments = 'Please select yes or no'
  if (d.will_have_employees === null) e.will_have_employees = 'Please select yes or no'
  return e
}

interface Props {
  data: Step3Data
  onChange: (data: Step3Data) => void
  onNext: () => void
  onBack: () => void
  loading: boolean
}

interface AddOnCardProps {
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  description: string
  price?: string
}

function AddOnCard({ checked, onChange, title, description, price }: AddOnCardProps) {
  return (
    <label
      className={`flex items-start gap-3 p-4 border-2 rounded-card cursor-pointer transition-colors duration-150 ${
        checked
          ? 'border-kw-gold bg-kw-gold/5'
          : 'border-kw-border-light bg-white hover:border-kw-gold/50'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[#C3A862] w-4 h-4 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold text-[14px] text-kw-forest">{title}</span>
          {price && <span className="text-[12px] font-bold text-kw-gold-dark">{price}</span>}
        </div>
        <p className="text-[12px] text-kw-text-secondary mt-0.5 leading-relaxed">{description}</p>
      </div>
    </label>
  )
}

function YesNo({ value, onChange, error }: { value: boolean | null; onChange: (v: boolean) => void; error?: string }) {
  return (
    <div>
      <div className="flex gap-3">
        {[true, false].map((v) => (
          <label
            key={String(v)}
            className={`flex items-center gap-2 px-5 py-2.5 border-2 rounded-card cursor-pointer text-sm font-semibold transition-colors ${
              value === v
                ? 'border-kw-gold bg-kw-gold/10 text-kw-forest'
                : 'border-kw-border-mid bg-white text-kw-text-secondary hover:border-kw-gold/50'
            }`}
          >
            <input
              type="radio"
              name={Math.random().toString(36)}
              checked={value === v}
              onChange={() => onChange(v)}
              className="sr-only"
            />
            {v ? 'Yes' : 'No'}
          </label>
        ))}
      </div>
      {error && <p className="form-error mt-1">{error}</p>}
    </div>
  )
}

export default function Step3Financial({ data, onChange, onNext, onBack, loading }: Props) {
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)

  function set<K extends keyof Step3Data>(key: K, value: Step3Data[K]) {
    const next = { ...data, [key]: value }
    onChange(next)
    if (submitted) setErrors(validate(next))
  }

  function setAddon(key: keyof OrderAddons, value: boolean) {
    set('addons', { ...data.addons, [key]: value })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const errs = validate(data)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-kw-forest font-normal mb-1">Financial Information</h2>
        <p className="text-kw-text-secondary text-sm">
          A few questions to help us serve you properly and prepare for tax setup.
        </p>
      </div>

      <div className="space-y-2">
        <label className="form-label">
          Anticipated Annual Revenue<span className="text-red-500 ml-0.5">*</span>
        </label>
        <div className="grid sm:grid-cols-2 gap-2">
          {REVENUE_OPTIONS.map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-3 px-4 py-3 border-2 rounded-card cursor-pointer text-[14px] transition-colors ${
                data.anticipated_annual_revenue === opt
                  ? 'border-kw-gold bg-kw-gold/5 font-semibold text-kw-forest'
                  : 'border-kw-border-light bg-white text-kw-text-secondary hover:border-kw-gold/50'
              }`}
            >
              <input
                type="radio"
                checked={data.anticipated_annual_revenue === opt}
                onChange={() => set('anticipated_annual_revenue', opt)}
                className="accent-[#C3A862] w-4 h-4 flex-shrink-0"
              />
              {opt}
            </label>
          ))}
        </div>
        {errors.anticipated_annual_revenue && (
          <p className="form-error">{errors.anticipated_annual_revenue}</p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="form-label">
            Will your business accept card or online payments?<span className="text-red-500 ml-0.5">*</span>
          </label>
          <YesNo
            value={data.accepts_card_or_online_payments}
            onChange={(v) => set('accepts_card_or_online_payments', v)}
            error={errors.accepts_card_or_online_payments}
          />
        </div>
        <div className="space-y-2">
          <label className="form-label">
            Do you anticipate having employees?<span className="text-red-500 ml-0.5">*</span>
          </label>
          <YesNo
            value={data.will_have_employees}
            onChange={(v) => set('will_have_employees', v)}
            error={errors.will_have_employees}
          />
        </div>
      </div>

      <FormField
        as="textarea"
        label="Notes on existing personal tax situation (optional)"
        name="personal_tax_notes"
        value={data.personal_tax_notes}
        onChange={(e) => set('personal_tax_notes', e.target.value)}
        rows={3}
        placeholder="Any existing tax considerations, prior-year notes, or questions for Kelli's team..."
        hint="This helps KelliWorks advise you on the best entity structure"
      />

      {/* Add-ons */}
      <div>
        <div className="mb-3">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-kw-forest mb-1">
            Add-On Services
          </h3>
          <p className="text-sm text-kw-text-secondary">Select any services you&apos;d like included in your formation package.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <AddOnCard
            checked={data.addons.ein}
            onChange={(v) => setAddon('ein', v)}
            title="EIN / Federal Tax ID"
            description="We obtain your Employer Identification Number so you're ready to open a business bank account and hire."
            price="Included"
          />
          <AddOnCard
            checked={data.addons.s_corp_election}
            onChange={(v) => setAddon('s_corp_election', v)}
            title="S-Corp Election"
            description="File IRS Form 2553 to elect S-Corp status for potential tax savings."
          />
          <AddOnCard
            checked={data.addons.expedited}
            onChange={(v) => setAddon('expedited', v)}
            title="Expedited Filing"
            description="Rush processing with your state for a faster turnaround on your formation."
          />
          <AddOnCard
            checked={data.addons.boi_report}
            onChange={(v) => setAddon('boi_report', v)}
            title="BOI Report"
            description="Beneficial Ownership Information report filing (required for most entities under the Corporate Transparency Act)."
          />
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-forest">
          &larr; Back
        </button>
        <button type="submit" className="btn-gold" disabled={loading}>
          {loading ? 'Saving...' : 'Continue to Payment \u2192'}
        </button>
      </div>
    </form>
  )
}
