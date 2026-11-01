"use client"

import { ArrowUpIcon, PlusIcon, XIcon } from "@/components/ui/icons"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// One button of a WhatsApp message: its text, what it does under it, and
// ways to move it up or remove it. Message editors list their buttons with it.
export function ButtonField({
  id,
  value,
  kind,
  maxLength,
  onChange,
  removeLabel,
  onRemove,
  moveUpLabel,
  onMoveUp,
  error,
}: {
  id: string
  value: string
  // What the button does; its placeholder and the line under it.
  kind: string
  maxLength: number
  onChange: (value: string) => void
  removeLabel?: string
  onRemove?: () => void
  moveUpLabel?: string
  onMoveUp?: () => void
  error?: string | null
}) {
  const errorId = `${id}-error`
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id} className="sr-only">
        {kind}
      </FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          value={value}
          maxLength={maxLength}
          placeholder={kind}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {(onMoveUp || onRemove) && (
          <InputGroupAddon align="inline-end">
            {onMoveUp && (
              <InputGroupButton size="icon-xs" aria-label={moveUpLabel} onClick={onMoveUp}>
                <ArrowUpIcon />
              </InputGroupButton>
            )}
            {onRemove && (
              <InputGroupButton size="icon-xs" aria-label={removeLabel} onClick={onRemove}>
                <XIcon />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        )}
      </InputGroup>
      {error ? (
        <FieldError id={errorId}>{error}</FieldError>
      ) : (
        <FieldDescription>{kind}</FieldDescription>
      )}
    </Field>
  )
}

// Adds one of the buttons a message may still take.
export function AddButtonSelect<T extends string>({
  items,
  label,
  onAdd,
}: {
  items: { value: T; label: string }[]
  label: string
  onAdd: (value: T) => void
}) {
  return (
    <Select items={items} value={null} onValueChange={(value) => value && onAdd(value as T)}>
      <SelectTrigger aria-label={label}>
        <PlusIcon />
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
