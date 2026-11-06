"use client"

import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import { PhoneCodeForm } from "@/components/phone-code-form"

// A signed-in account with no phone yet adds the one it booked with, by a
// code sent to it; then My bookings shows that phone's bookings.
export function AddPhoneForm() {
  const t = useTranslations("public.account")
  const booking = useTranslations("public.booking")
  const locale = useLocale()
  const router = useRouter()
  return (
    <PhoneCodeForm
      purpose="addPhone"
      onDone={() => router.refresh()}
      labels={{
        phone: booking("phone"),
        phoneHelp: t("phoneHelp"),
        sendCode: t("sendCode"),
        sendingCode: t("sendingCode"),
        code: t("code"),
        codeSentTo: (phone) => t("codeSentTo", { phone }),
        verify: t("verify"),
        checking: t("checking"),
        newCode: t("newCode"),
        changePhone: t("changePhone"),
        wrongCode: t("wrongCode"),
        expiredCode: t("expiredCode"),
        tooManyTries: t("tooManyTries"),
        tooFast: t("tooFast"),
        phoneTaken: t("phoneTaken"),
        sendFailed: t("sendFailed"),
      }}
      locale={locale}
    />
  )
}
