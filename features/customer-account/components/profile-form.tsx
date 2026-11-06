"use client"

import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { PhoneCodeForm } from "@/components/phone-code-form"
import { PhotoField } from "@/components/photo-upload"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { MailIcon, PhoneIcon } from "@/components/ui/icons"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { ACCOUNT_RULES } from "@/lib/account-rules"
import { initials } from "@/lib/initials"
import {
  removeAccountPhoto,
  saveAccountName,
  setAccountPhoto,
} from "../api/profile"

// The client's Profile: their photo and name, then how they log in and
// are found: email, and phone (added or changed with a WhatsApp code,
// when codes can be sent), whose bookings show in Bookings.
export function ProfileForm({
  name,
  photoUrl,
  email,
  phone,
  phoneCodes,
  openPhone = false,
}: {
  name: string
  photoUrl: string | null
  email: string | null
  // The verified phone, formatted for reading.
  phone: string | null
  // Whether WhatsApp codes can be sent (lib/phone-sign-in.ts).
  phoneCodes: boolean
  // Start with the phone panel open.
  openPhone?: boolean
}) {
  const t = useTranslations("public.account.profile")
  const [typed, setTyped] = useState(name)
  const [pending, startTransition] = useTransition()
  const [phoneOpen, setPhoneOpen] = useState(openPhone && phoneCodes)
  const router = useRouter()
  const trimmed = typed.trim()
  return (
    <div className="flex flex-col gap-8">
      <PhotoField
        label={t("photo")}
        photoUrl={photoUrl}
        fallback={initials(name)}
        upload={setAccountPhoto}
        remove={removeAccountPhoto}
      />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          startTransition(async () => {
            const result = await saveAccountName(trimmed).catch(() => null)
            if (result?.ok) {
              toast.success(t("saved"))
              router.refresh()
            } else {
              toast.error(t("failed"))
            }
          })
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="account-name">{t("name")}</FieldLabel>
            <Input
              id="account-name"
              autoComplete="name"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              maxLength={ACCOUNT_RULES.maxName}
              disabled={pending}
            />
          </Field>
          <Button
            type="submit"
            size="lg"
            className="self-start"
            disabled={pending || !trimmed || trimmed === name}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {t("save")}
          </Button>
        </FieldGroup>
      </form>
      <ItemGroup className="gap-3">
        {email && (
          <Item variant="box">
            <ItemMedia variant="icon">
              <MailIcon />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemDescription>{t("email")}</ItemDescription>
              <ItemTitle className="truncate">{email}</ItemTitle>
            </ItemContent>
          </Item>
        )}
        {(phone || phoneCodes) && (
          <Item variant="box">
            <ItemMedia variant="icon">
              <PhoneIcon />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemDescription>{t("phone")}</ItemDescription>
              {phone ? (
                <ItemTitle className="truncate">{phone}</ItemTitle>
              ) : (
                <ItemDescription>{t("phoneInfo")}</ItemDescription>
              )}
            </ItemContent>
            {phoneCodes && (
              <ItemActions>
                <Button variant="outline" onClick={() => setPhoneOpen(true)}>
                  {phone ? t("changePhone") : t("addPhone")}
                </Button>
              </ItemActions>
            )}
          </Item>
        )}
      </ItemGroup>
      {phoneCodes && (
        <ResponsivePanel
          open={phoneOpen}
          onClose={() => setPhoneOpen(false)}
          title={phone ? t("changePhone") : t("addPhone")}
          description={t("phoneInfo")}
        >
          <AccountPhoneForm
            onDone={() => {
              setPhoneOpen(false)
              toast.success(t("saved"))
              router.refresh()
            }}
          />
        </ResponsivePanel>
      )}
    </div>
  )
}

// The shared phone-and-code form, adding the phone to this account.
function AccountPhoneForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("public.account")
  const locale = useLocale()
  return (
    <PhoneCodeForm
      purpose="addPhone"
      onDone={onDone}
      autoFocus
      labels={{
        phone: t("profile.phone"),
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
