import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

// A password on any account screen: log in, sign up or a new one.
// `autoComplete` tells password managers which it is. `children` sit under
// it, after any error.
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
  disabled,
  error,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: "current-password" | "new-password"
  autoFocus?: boolean
  disabled?: boolean
  error?: string | null
  children?: React.ReactNode
}) {
  const errorId = `${id}-error`
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
      {children}
    </Field>
  )
}
