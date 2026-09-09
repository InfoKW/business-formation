'use client'

import { useState } from 'react'
import FormField from '@/components/FormField'
import type { Step1Data, EntityType } from '@/types'

const ENTITY_TYPES: EntityType[] = [
  'LLC',
  'S-Corp',
  'C-Corp',
  'Sole Proprietorship',
  'Partnership',
  'Non-Profit',
  'Not sure - advise me',
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC',
]

interface Props {
  data: Step1Data
  onChange: (data: Step1Data) => void
  onNext: () => void
  loading: boolean
}

type Errors = Partial<Record<keyof Step1Data, string>>

function validate(d: Step1Data): Errors {
  const e: Errors = {}
  if (!d.business_name_choice_1.trim()) e.business_name_choice_1 = 'Business name is required'
  if (!d.entity_type) e.entity_type = 'Please select an entity type'
  if (!d.formation_state) e.formation_state = 'Please select a formation state'
  if (!d.business_description.trim()) e.business_description = 'Please describe your business'
  if (!d.business_address.trim()) e.business_address = 'Business address is required'
  if (!d.anticipated_start_date) e.anticipated_start_date = 'Anticipated start date is required'
  if (!d.contact_email.trim()) e.contact_email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contact_email)) e.contact_email = 'Enter a valid email address'
  return e
}

export default function Step1Business({ data, onChange, onNext, loading }: Props) {
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)

  function set<K extends keyof Step1Data>(key: K, value: Step1Data[K]) {
    const next = { ...data, [key]: value }
    onChange(next)
    if (submitted) setErrors(validate(next))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const errs = validate(data)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-kw-forest font-normal mb-1">Business Formation Details</h2>
        <p className="text-kw-text-secondary text-sm">
          Enter your proposed business name and tell us about the entity you&apos;re forming.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <FormField
          label="Proposed Business Name (1st choice)"
          name="business_name_choice_1"
          value={data.business_name_choice_1}
          onChange={(e) => set('business_name_choice_1', e.target.value)}
          error={errors.business_name_choice_1}
          required
          placeholder="e.g. Sunrise Consulting LLC"
        />
        <FormField
          label="Proposed Business Name (2nd choice)"
          name="business_name_choice_2"
          value={data.business_name_choice_2}
          onChange={(e) => set('business_name_choice_2', e.target.value)}
          placeholder="Optional alternate name"
          hint="In case your first choice isn't available"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <FormField
          as="select"
          label="Entity Type"
          name="entity_type"
          value={data.entity_type}
          onChange={(e) => set('entity_type', e.target.value as EntityType)}
          error={errors.entity_type}
          required
        >
          <option value="">Select entity type...</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </FormField>

        <FormField
          as="select"
          label="State of Formation"
          name="formation_state"
          value={data.formation_state}
          onChange={(e) => set('formation_state', e.target.value)}
          error={errors.formation_state}
          required
          hint="The state where the entity will be legally formed"
        >
          <option value="">Select state...</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </FormField>
      </div>

      <FormField
        as="textarea"
        label="Business Description"
        name="business_description"
        value={data.business_description}
        onChange={(e) => set('business_description', e.target.value)}
        error={errors.business_description}
        required
        rows={3}
        placeholder="Briefly describe what your business will do..."
      />

      <FormField
        label="Business Address"
        name="business_address"
        value={data.business_address}
        onChange={(e) => set('business_address', e.target.value)}
        error={errors.business_address}
        required
        placeholder="Street, City, State, ZIP"
        hint="This will be used as the registered business address"
      />

      <FormField
        label="Anticipated Start Date"
        name="anticipated_start_date"
        type="date"
        value={data.anticipated_start_date}
        onChange={(e) => set('anticipated_start_date', e.target.value)}
        error={errors.anticipated_start_date}
        required
      />

      <div className="border-t border-kw-border-light pt-6">
        <h3 className="text-[13px] font-bold text-kw-forest uppercase tracking-[0.06em] mb-4">Your Contact Information</h3>
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField
            label="Email Address"
            name="contact_email"
            type="email"
            value={data.contact_email}
            onChange={(e) => set('contact_email', e.target.value)}
            error={errors.contact_email}
            required
            placeholder="you@example.com"
            hint="Order confirmations will be sent here"
          />
          <FormField
            label="Phone Number"
            name="contact_phone"
            type="tel"
            value={data.contact_phone}
            onChange={(e) => set('contact_phone', e.target.value)}
            placeholder="(555) 000-0000"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-gold" disabled={loading}>
          {loading ? 'Saving...' : 'Continue to Owner Details \u2192'}
        </button>
      </div>
    </form>
  )
}
