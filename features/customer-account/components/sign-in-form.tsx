"use client"

import { useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"

import { useMessages } from "@/components/language-provider"
import { PhoneInput } from "@/components/phone-input"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { customerAuthClient } from "@/lib/customer-auth-client"
import { BOOKED_PHONE_KEY } from "@/lib/customer-auth-path"

type Problem =
  "wrongCode" | "expiredCode" | "tooManyTries" | "tooFast" | "sendFailed"

// Better Auth's answer (its phone-number plugin's error codes, and 429 from
// its rate limit) as the line the customer reads.
function problemFor(error: { status: number; code?: string }): Problem {
  if (error.status === 429) return "tooFast"
  if (error.code === "OTP_EXPIRED" || error.code === "OTP_NOT_FOUND")
    return "expiredCode"
  if (error.code === "TOO_MANY_ATTEMPTS") return "tooManyTries"
  if (error.code === "INVALID_OTP") return "wrongCode"
  return "sendFailed"
}

const noChanges = () => () => {}

function bookedPhone(): string {
  try {
    return sessionStorage.getItem(BOOKED_PHONE_KEY) ?? ""
  } catch {
    return ""
  }
}

// Two steps on one card: the phone they booked with, then the code sent to
// it. The first right code makes their profile and signs them in.
export function SignInForm({ next }: { next: string }) {
  const m = useMessages()
  const t = m.account
  const router = useRouter()
  const remembered = useSyncExternalStore(noChanges, bookedPhone, () => "")
  const [typed, setTyped] = useState<string | null>(null)
  const phone = typed ?? remembered
  const [step, setStep] = useState<"phone" | "code">("phone")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  const sendCode = async () => {
    setBusy(true)
    setProblem(null)
    const { error } = await customerAuthClient.phoneNumber.sendOtp({
      phoneNumber: phone,
    })
    setBusy(false)
    if (error) {
      setProblem(problemFor(error))
      return
    }
    setCode("")
    setStep("code")
  }

  const verify = async () => {
    setBusy(true)
    setProblem(null)
    const { error } = await customerAuthClient.phoneNumber.verify({
      phoneNumber: phone,
      code,
    })
    if (error) {
      setBusy(false)
      setProblem(problemFor(error))
      return
    }
    router.replace(next)
    router.refresh()
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void (step === "phone" ? sendCode() : verify())
  }

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        {step === "phone" ? (
          <Field data-invalid={problem ? true : undefined}>
            <FieldLabel htmlFor="customer-phone">{m.booking.phone}</FieldLabel>
            <PhoneInput
              id="customer-phone"
              value={phone}
              onChange={setTyped}
              locale={m.locale}
              autoComplete="tel"
              required
            />
            {problem ? (
              <FieldError>{t[problem]}</FieldError>
            ) : (
              <FieldDescription>{t.phoneHelp}</FieldDescription>
            )}
          </Field>
        ) : (
          <Field data-invalid={problem ? true : undefined}>
            <FieldLabel htmlFor="customer-code">{t.code}</FieldLabel>
            <Input
              id="customer-code"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              required
            />
            {problem ? (
              <FieldError>{t[problem]}</FieldError>
            ) : (
              <FieldDescription>{t.codeSentTo(phone)}</FieldDescription>
            )}
          </Field>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={busy || (step === "phone" ? !phone : code.length < 6)}
        >
          {busy && <Spinner data-icon="inline-start" />}
          {step === "phone"
            ? busy
              ? t.sendingCode
              : t.sendCode
            : busy
              ? t.checking
              : t.verify}
        </Button>
        {step === "code" && (
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="link"
              disabled={busy}
              onClick={() => void sendCode()}
            >
              {t.newCode}
            </Button>
            <Button
              type="button"
              variant="link"
              disabled={busy}
              onClick={() => {
                setProblem(null)
                setStep("phone")
              }}
            >
              {t.changePhone}
            </Button>
          </div>
        )}
      </FieldGroup>
    </form>
  )
}
