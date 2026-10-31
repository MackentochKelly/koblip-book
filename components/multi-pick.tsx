"use client"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"

export interface PickItem {
  value: string
  label: string
}

// Pick several from a list (shadcn's combobox with chips): the picked ones
// show as chips in the field, typing filters the list. `value` keeps the
// list's order whatever order they were picked in.
export function MultiPick({
  id,
  items,
  value,
  onChange,
  placeholder,
  empty,
  invalid,
}: {
  id?: string
  items: PickItem[]
  value: string[]
  onChange: (value: string[]) => void
  // Shown in the field while nothing is picked.
  placeholder?: string
  // Shown in the list when typing matches nothing.
  empty: string
  invalid?: boolean
}) {
  const anchor = useComboboxAnchor()
  const labels = new Map(items.map((item) => [item.value, item.label]))
  return (
    <Combobox
      multiple
      autoHighlight
      items={items.map((item) => item.value)}
      itemToStringLabel={(item: string) => labels.get(item) ?? item}
      value={value}
      onValueChange={(next) =>
        onChange(
          items
            .map((item) => item.value)
            .filter((item) => next.includes(item))
        )
      }
    >
      <ComboboxChips ref={anchor} className="min-h-11">
        <ComboboxValue>
          {(picked: string[]) => (
            <>
              {picked.map((item) => (
                <ComboboxChip key={item}>{labels.get(item)}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                placeholder={picked.length === 0 ? placeholder : undefined}
                aria-invalid={invalid || undefined}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{empty}</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {labels.get(item)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
