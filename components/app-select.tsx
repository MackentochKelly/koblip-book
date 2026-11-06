"use client"

import * as React from "react"
import { cn } from "cn"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface AppSelectOption<T extends string = string> {
  value: T
  label: string
  icon?: React.ReactNode
  // One short line under the label.
  description?: string
  // Options with the same group, next to each other, share a labelled group.
  group?: string
  disabled?: boolean
}

interface AppSelectBaseProps<T extends string> {
  options: readonly AppSelectOption<T>[]
  id?: string
  "aria-label"?: string
  // Shown in the field while nothing is picked.
  placeholder?: string
  // Shown at the start of the field, before the value.
  icon?: React.ReactNode
  size?: "sm" | "default"
  // The field's width and place, like `w-full`.
  className?: string
  invalid?: boolean
  disabled?: boolean
}

interface AppSelectSingleProps<T extends string> extends AppSelectBaseProps<T> {
  multiple?: false
  value: T | null
  onValueChange: (value: T) => void
}

interface AppSelectMultipleProps<
  T extends string,
> extends AppSelectBaseProps<T> {
  multiple: true
  value: T[]
  // Picked values in the list's order, whatever order they were picked in.
  onValueChange: (value: T[]) => void
}

export type AppSelectProps<T extends string> =
  AppSelectSingleProps<T> | AppSelectMultipleProps<T>

// The app's one select: shadcn's Select with options, optional groups,
// icons and descriptions, for one or several picks. The list is at least
// as wide as the field and long labels wrap, so nothing is cut off.
export function AppSelect<T extends string>(props: AppSelectProps<T>) {
  const { options, id, placeholder, icon, size, className, invalid, disabled } =
    props
  const byValue = new Map(options.map((option) => [option.value, option]))

  function shown(value: T | T[] | null) {
    const picked = (Array.isArray(value) ? value : value ? [value] : [])
      .map((item) => byValue.get(item))
      .filter((option) => option !== undefined)
    if (picked.length === 0) return placeholder
    if (picked.length === 1) {
      return (
        <>
          {picked[0].icon}
          <span className="truncate">{picked[0].label}</span>
        </>
      )
    }
    return (
      <span className="truncate">
        {picked.map((option) => option.label).join(", ")}
      </span>
    )
  }

  const field = (
    <>
      <SelectTrigger
        id={id}
        size={size}
        aria-label={props["aria-label"]}
        aria-invalid={invalid || undefined}
        className={cn("max-w-full min-w-0", className)}
      >
        {icon}
        <SelectValue className="min-w-0">{shown}</SelectValue>
      </SelectTrigger>
      <SelectContent className="w-auto max-w-(--available-width) min-w-(--anchor-width)">
        {groupsOf(options).map((group, index) => (
          <React.Fragment key={group.key}>
            {index > 0 && <SelectSeparator />}
            <SelectGroup>
              {group.label && <SelectLabel>{group.label}</SelectLabel>}
              {group.options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="*:first:min-w-0 *:first:shrink *:first:items-center *:first:whitespace-normal pointer-coarse:min-h-11"
                >
                  {option.icon}
                  <span className="flex min-w-0 flex-col wrap-break-word">
                    {option.label}
                    {option.description && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </React.Fragment>
        ))}
      </SelectContent>
    </>
  )

  const items = options.map(({ value, label }) => ({ value, label }))

  if (props.multiple) {
    const order = options.map((option) => option.value)
    return (
      <Select
        multiple
        items={items}
        value={props.value}
        disabled={disabled}
        onValueChange={(next: T[]) =>
          props.onValueChange(order.filter((item) => next.includes(item)))
        }
      >
        {field}
      </Select>
    )
  }

  const { onValueChange } = props
  return (
    <Select
      items={items}
      value={props.value}
      disabled={disabled}
      onValueChange={(next: T | null) => {
        if (next !== null) onValueChange(next)
      }}
    >
      {field}
    </Select>
  )
}

// Runs of options that share a group, in the list's order.
function groupsOf<T extends string>(options: readonly AppSelectOption<T>[]) {
  const groups: {
    key: string
    label?: string
    options: AppSelectOption<T>[]
  }[] = []
  for (const option of options) {
    const last = groups.at(-1)
    if (last && last.label === option.group) last.options.push(option)
    else
      groups.push({
        key: `${groups.length}-${option.group ?? ""}`,
        label: option.group,
        options: [option],
      })
  }
  return groups
}
