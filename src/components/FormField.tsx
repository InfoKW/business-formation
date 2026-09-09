import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface BaseProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
}

interface InputProps extends BaseProps, InputHTMLAttributes<HTMLInputElement> {
  as?: 'input'
}
interface SelectProps extends BaseProps, SelectHTMLAttributes<HTMLSelectElement> {
  as: 'select'
  children: React.ReactNode
}
interface TextareaProps extends BaseProps, TextareaHTMLAttributes<HTMLTextAreaElement> {
  as: 'textarea'
  rows?: number
}

type Props = InputProps | SelectProps | TextareaProps

export default function FormField(props: Props) {
  const { label, error, hint, required, as = 'input', ...rest } = props

  const id = (rest as InputHTMLAttributes<HTMLInputElement>).id
    ?? (rest as InputHTMLAttributes<HTMLInputElement>).name
    ?? label.toLowerCase().replace(/\s+/g, '-')

  const baseClass = `form-input${error ? ' form-input-error' : ''}`

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="form-label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {as === 'select' ? (
        <select id={id} className={`form-select${error ? ' form-input-error' : ''}`} {...(rest as SelectHTMLAttributes<HTMLSelectElement>)}>
          {(props as SelectProps).children}
        </select>
      ) : as === 'textarea' ? (
        <textarea
          id={id}
          className={`form-textarea${error ? ' form-input-error' : ''}`}
          rows={(props as TextareaProps).rows ?? 4}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input id={id} className={baseClass} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}

      {error && <p className="form-error">{error}</p>}
      {hint && !error && <p className="form-hint">{hint}</p>}
    </div>
  )
}
