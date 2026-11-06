"use client"

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { useMemo, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { detectCountry, FALLBACK_COUNTRY } from "@/lib/phone-country"
import { cn } from "@/lib/utils"

const PhoneFlag = dynamic(() => import("@/components/phone-flag"), {
  ssr: false,
  loading: () => <span className="block h-4 w-6 rounded-sm bg-muted" />,
})

const noChanges = () => () => {}

type Shown = {
  // What the form holds: the whole number, as +18095550101.
  value: string
  // The country the person or the number chose; null follows the browser.
  country: CountryCode | null
  // What the box shows: the number without its country code.
  text: string
}

function read(value: string): Shown {
  const parsed = value.startsWith("+") ? parsePhoneNumberFromString(value) : undefined
  return parsed?.country
    ? { value, country: parsed.country, text: parsed.nationalNumber }
    : { value, country: null, text: value }
}

// A phone number with its country: the flag and code, already set to where
// the person seems to be, then the number the way they say it at home. The
// form gets the whole international number.
export function PhoneInput({
  value,
  onChange,
  locale,
  className,
  disabled,
  ...input
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string
  onChange: (value: string) => void
  locale: string
}) {
  const detected = useSyncExternalStore(noChanges, detectCountry, () => FALLBACK_COUNTRY)
  const [stored, setStored] = useState(() => read(value))
  // The form changed it (a reset, another customer): start from its number.
  let shown = stored
  if (value !== stored.value) {
    shown = read(value)
    setStored(shown)
  }
  const country = shown.country ?? detected
  const t = useTranslations("app.phoneInput")
  const labels = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" })
    return new Map(
      getCountries()
        .map((code) => [code, `${names.of(code) ?? code} +${getCountryCallingCode(code)}`] as const)
        .sort(([, a], [, b]) => a.localeCompare(b, locale))
    )
  }, [locale])

  const show = (next: Shown) => {
    setStored(next)
    if (next.value !== value) onChange(next.value)
  }

  const type = (text: string) => {
    const digits = text.replace(/\D/g, "")
    if (text.trim().startsWith("+")) {
      // Pasted or filled in with its code: the code picks the country.
      const whole = parsePhoneNumberFromString(text)
      show(
        whole?.country
          ? { value: whole.number, country: whole.country, text: whole.nationalNumber }
          : { value: text.trim(), country: shown.country, text }
      )
      return
    }
    if (!digits) {
      show({ value: "", country: shown.country, text })
      return
    }
    const parsed = parsePhoneNumberFromString(text, { defaultCountry: country })
    show(
      parsed?.isValid()
        ? { value: parsed.number, country: parsed.country ?? country, text }
        : { value: `+${getCountryCallingCode(country)}${digits}`, country, text }
    )
  }

  const pick = (next: CountryCode) => {
    const digits = shown.text.replace(/\D/g, "")
    const parsed = digits ? parsePhoneNumberFromString(shown.text, { defaultCountry: next }) : undefined
    show({
      value: !digits ? "" : parsed?.isValid() ? parsed.number : `+${getCountryCallingCode(next)}${digits}`,
      country: next,
      text: shown.text,
    })
  }

  return (
    <div className="flex items-stretch gap-2">
      <Combobox
        autoHighlight
        items={[...labels.keys()]}
        itemToStringLabel={(code: CountryCode) => labels.get(code) ?? code}
        value={country}
        onValueChange={(next: CountryCode | null) => {
          if (next) pick(next)
        }}
      >
        <ComboboxTrigger
          aria-label={t("country")}
          disabled={disabled}
          render={<Button type="button" variant="outline" className={cn("h-auto shrink-0 tabular-nums", className)} />}
        >
          <PhoneFlag country={country} />+{getCountryCallingCode(country)}
        </ComboboxTrigger>
        <ComboboxContent className="min-w-64">
          <ComboboxInput showTrigger={false} placeholder={t("search")} className="m-1" />
          <ComboboxEmpty>{t("empty")}</ComboboxEmpty>
          <ComboboxList>
            {(code: CountryCode) => (
              <ComboboxItem key={code} value={code}>
                <PhoneFlag country={code} />
                {labels.get(code)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Input
        {...input}
        type="tel"
        inputMode="tel"
        disabled={disabled}
        className={cn("min-w-0 flex-1", className)}
        value={shown.text}
        onChange={(event) => type(event.target.value)}
      />
    </div>
  )
}
