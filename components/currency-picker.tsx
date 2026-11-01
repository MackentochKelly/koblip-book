"use client"

import { useMemo } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

// A searchable currency list: every currency the browser knows
// (Intl.supportedValuesOf), each named in the owner's language
// (Intl.DisplayNames): "Dominican Peso (DOP)".
export function CurrencyPicker({
  id,
  value,
  onChange,
  locale,
  empty,
}: {
  id: string
  value: string
  onChange: (currency: string) => void
  locale: string
  // Shown when the search finds none.
  empty: string
}) {
  const labels = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "currency" })
    const codes = Intl.supportedValuesOf("currency")
    // The saved one stays even if this browser does not list it.
    if (!codes.includes(value)) codes.push(value)
    return new Map(
      codes.map((code) => [code, `${names.of(code) ?? code} (${code})`])
    )
  }, [locale, value])
  return (
    <Combobox
      autoHighlight
      items={[...labels.keys()]}
      itemToStringLabel={(code: string) => labels.get(code) ?? code}
      value={value}
      onValueChange={(next: string | null) => {
        if (next) onChange(next)
      }}
    >
      <ComboboxInput id={id} className="h-11" />
      <ComboboxContent>
        <ComboboxEmpty>{empty}</ComboboxEmpty>
        <ComboboxList>
          {(code: string) => (
            <ComboboxItem key={code} value={code}>
              {labels.get(code)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
