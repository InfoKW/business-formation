const STEPS = [
  { n: 1, label: 'Business Info' },
  { n: 2, label: 'Owners' },
  { n: 3, label: 'Financials' },
  { n: 4, label: 'Payment' },
]

interface Props {
  current: number
}

export default function StepIndicator({ current }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, i) => {
        const done    = step.n < current
        const active  = step.n === current
        const future  = step.n > current

        return (
          <div key={step.n} className="flex items-center">
            {/* Connector line */}
            {i > 0 && (
              <div
                className={`h-px w-10 sm:w-16 transition-colors duration-300 ${
                  done ? 'bg-kw-gold' : 'bg-kw-border-mid'
                }`}
              />
            )}

            {/* Circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  done
                    ? 'bg-kw-gold text-kw-forest'
                    : active
                    ? 'bg-kw-forest text-white ring-2 ring-kw-gold ring-offset-2'
                    : 'bg-kw-bg-secondary text-kw-text-muted'
                }`}
              >
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  step.n
                )}
              </div>
              <span
                className={`text-[10px] font-semibold tracking-[0.06em] uppercase hidden sm:block ${
                  active ? 'text-kw-forest' : future ? 'text-kw-text-muted' : 'text-kw-gold-dark'
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
