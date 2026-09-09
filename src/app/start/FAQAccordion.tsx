'use client'

import { useState } from 'react'

const faqs = [
  {
    q: 'How long does it take to form an LLC or corporation?',
    a: "Timelines vary by state - most standard filings take a few weeks. If you need your business formed faster, expedited processing is available in most states for an added fee. We'll give you a specific estimate for your state when you start your application.",
  },
  {
    q: 'Do I need a registered agent?',
    a: "Yes - every LLC and corporation is legally required to have a registered agent in the state where it's formed. KelliWorks can serve as your registered agent, so you always have someone receiving your legal and state mail.",
  },
  {
    q: "What's included when KelliWorks forms my business?",
    a: 'Formation includes your state filing, registered agent service, and help getting your EIN and business bank account set up. Add-ons like S-Corp election, business license research, and BOI reporting are available depending on what your business needs.',
  },
  {
    q: 'Can KelliWorks help with ongoing compliance after my business is formed?',
    a: "Yes - we monitor your state's filing deadlines (annual reports, renewals, etc.) and handle them for you, so your business stays in good standing without you having to track it yourself.",
  },
]

export default function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div>
      {faqs.map((faq, i) => (
        <div key={i} className={`border-b border-kw-border-mid ${i === 0 ? 'border-t' : ''}`}>
          <button
            className="w-full flex items-center justify-between gap-4 py-5 font-secondary text-[15px] text-kw-forest text-left hover:text-kw-gold-dark transition-colors"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            {faq.q}
            <span
              className={`flex-shrink-0 w-6 h-6 border border-kw-border-mid rounded-full flex items-center justify-center text-sm transition-all duration-200 ${
                open === i
                  ? 'rotate-45 bg-kw-gold text-white border-kw-gold'
                  : 'text-kw-gold'
              }`}
            >
              +
            </span>
          </button>
          {open === i && (
            <p className="text-kw-text-secondary text-[14px] leading-relaxed pb-5">{faq.a}</p>
          )}
        </div>
      ))}
    </div>
  )
}
