'use client'

import { useState } from 'react'
import FormField from '@/components/FormField'
import type { Step2Data, OwnerFormData, CitizenshipStatus } from '@/types'

const CITIZENSHIP_OPTIONS: CitizenshipStatus[] = ['US Citizen', 'Permanent Resident', 'Other']

const BLANK_OWNER: OwnerFormData = {
  first_name: '',
  middle_name: '',
  last_name: '',
  date_of_birth: '',
  ownership_percentage: '',
  ssn_full: '',
  citizenship_status: '',
  mailing_address: '',
  personal_address: '',
  phone: '',
  email: '',
}

type OwnerErrors = Partial<Record<keyof OwnerFormData, string>>

function validateOwner(o: OwnerFormData): OwnerErrors {
  const e: OwnerErrors = {}
  if (!o.first_name.trim()) e.first_name = 'Required'
  if (!o.last_name.trim()) e.last_name = 'Required'
  if (!o.date_of_birth) e.date_of_birth = 'Required'
  const pct = parseFloat(o.ownership_percentage)
  if (!o.ownership_percentage || isNaN(pct) || pct <= 0 || pct > 100)
    e.ownership_percentage = 'Enter a percentage between 1 and 100'
  const digits = o.ssn_full.replace(/\D/g, '')
  if (!digits || digits.length !== 9) e.ssn_full = 'SSN must be 9 digits'
  if (!o.citizenship_status) e.citizenship_status = 'Required'
  if (!o.mailing_address.trim()) e.mailing_address = 'Required'
  if (!o.phone.trim()) e.phone = 'Required'
  if (!o.email.trim()) e.email = 'Required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) e.email = 'Enter a valid email'
  return e
}

interface Props {
  data: Step2Data
  onChange: (data: Step2Data) => void
  onNext: () => void
  onBack: () => void
  loading: boolean
}

export default function Step2Owners({ data, onChange, onNext, onBack, loading }: Props) {
  const [errors, setErrors] = useState<OwnerErrors[]>([{}])
  const [submitted, setSubmitted] = useState(false)

  const owners = data.owners.length > 0 ? data.owners : [{ ...BLANK_OWNER }]

  function setOwner(idx: number, key: keyof OwnerFormData, value: string) {
    const updated = owners.map((o, i) => i === idx ? { ...o, [key]: value } : o)
    onChange({ owners: updated })
    if (submitted) {
      const updatedErrors = updated.map(validateOwner)
      setErrors(updatedErrors)
    }
  }

  function addOwner() {
    onChange({ owners: [...owners, { ...BLANK_OWNER }] })
    setErrors([...errors, {}])
  }

  function removeOwner(idx: number) {
    if (owners.length === 1) return
    onChange({ owners: owners.filter((_, i) => i !== idx) })
    setErrors(errors.filter((_, i) => i !== idx))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const allErrors = owners.map(validateOwner)
    setErrors(allErrors)
    const hasErrors = allErrors.some((e) => Object.keys(e).length > 0)
    if (hasErrors) return
    onNext()
  }

  // Format SSN as user types: 123-45-6789
  function handleSsnChange(idx: number, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 9)
    let formatted = digits
    if (digits.length > 5) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
    else if (digits.length > 3) formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`
    setOwner(idx, 'ssn_full', formatted)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-kw-forest font-normal mb-1">Owner / Member Details</h2>
        <p className="text-kw-text-secondary text-sm">
          Add information for each owner or member. Click &ldquo;Add another owner&rdquo; if there are
          multiple people with ownership interest.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-card p-4 text-sm text-amber-800">
        <strong>Privacy note:</strong> Your Social Security Number is collected only to complete
        the EIN application and is transmitted securely. It is never stored in plain text and is
        deleted from our systems once your formation order is submitted.
      </div>

      {owners.map((owner, idx) => (
        <div key={idx} className="border border-kw-border-light rounded-card p-6 space-y-5 relative">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-kw-forest">
              {idx === 0 ? 'Primary Owner / Member' : `Owner / Member ${idx + 1}`}
            </h3>
            {owners.length > 1 && (
              <button
                type="button"
                onClick={() => removeOwner(idx)}
                className="text-[12px] text-red-500 hover:text-red-700 font-medium"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <FormField
              label="First Name"
              name={`first_name_${idx}`}
              value={owner.first_name}
              onChange={(e) => setOwner(idx, 'first_name', e.target.value)}
              error={errors[idx]?.first_name}
              required
            />
            <FormField
              label="Middle Name"
              name={`middle_name_${idx}`}
              value={owner.middle_name}
              onChange={(e) => setOwner(idx, 'middle_name', e.target.value)}
              placeholder="Optional"
            />
            <FormField
              label="Last Name"
              name={`last_name_${idx}`}
              value={owner.last_name}
              onChange={(e) => setOwner(idx, 'last_name', e.target.value)}
              error={errors[idx]?.last_name}
              required
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <FormField
              label="Date of Birth"
              name={`dob_${idx}`}
              type="date"
              value={owner.date_of_birth}
              onChange={(e) => setOwner(idx, 'date_of_birth', e.target.value)}
              error={errors[idx]?.date_of_birth}
              required
            />
            <FormField
              label="Ownership %"
              name={`pct_${idx}`}
              type="number"
              min="1"
              max="100"
              step="0.01"
              value={owner.ownership_percentage}
              onChange={(e) => setOwner(idx, 'ownership_percentage', e.target.value)}
              error={errors[idx]?.ownership_percentage}
              required
              placeholder="e.g. 100"
            />
            <FormField
              as="select"
              label="Citizenship Status"
              name={`citizenship_${idx}`}
              value={owner.citizenship_status}
              onChange={(e) => setOwner(idx, 'citizenship_status', e.target.value as CitizenshipStatus)}
              error={errors[idx]?.citizenship_status}
              required
            >
              <option value="">Select...</option>
              {CITIZENSHIP_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </FormField>
          </div>

          <FormField
            label="Social Security Number"
            name={`ssn_${idx}`}
            type="password"
            inputMode="numeric"
            value={owner.ssn_full}
            onChange={(e) => handleSsnChange(idx, e.target.value)}
            error={errors[idx]?.ssn_full}
            required
            placeholder="XXX-XX-XXXX"
            autoComplete="off"
            hint="Securely encrypted - never stored in plain text"
          />

          <FormField
            label="Mailing Address"
            name={`mailing_${idx}`}
            value={owner.mailing_address}
            onChange={(e) => setOwner(idx, 'mailing_address', e.target.value)}
            error={errors[idx]?.mailing_address}
            required
            placeholder="Street, City, State, ZIP"
          />

          <FormField
            label="Personal Address (if different from mailing)"
            name={`personal_${idx}`}
            value={owner.personal_address}
            onChange={(e) => setOwner(idx, 'personal_address', e.target.value)}
            placeholder="Optional"
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              label="Phone"
              name={`phone_${idx}`}
              type="tel"
              value={owner.phone}
              onChange={(e) => setOwner(idx, 'phone', e.target.value)}
              error={errors[idx]?.phone}
              required
              placeholder="(555) 000-0000"
            />
            <FormField
              label="Email"
              name={`email_${idx}`}
              type="email"
              value={owner.email}
              onChange={(e) => setOwner(idx, 'email', e.target.value)}
              error={errors[idx]?.email}
              required
              placeholder="owner@example.com"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addOwner}
        className="text-[13px] font-semibold text-kw-gold-dark hover:text-kw-forest underline underline-offset-2"
      >
        + Add another owner / member
      </button>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-forest">
          &larr; Back
        </button>
        <button type="submit" className="btn-gold" disabled={loading}>
          {loading ? 'Saving...' : 'Continue to Financial Info \u2192'}
        </button>
      </div>
    </form>
  )
}
