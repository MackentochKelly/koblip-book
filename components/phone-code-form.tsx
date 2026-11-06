"use client"

import { useState, useSyncExternalStore } from "react"
import { REGEXP_ONLY_DIGITS } from "input-otp"

import { PhoneInput } from "@/components/phone-input"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { BOOKED_PHONE_KEY } from "@/lib/my-bookings-links"

export type PhoneCodeProblem =
  | "wrongCode"
  | "expiredCode"
  | "tooManyTries"
  | "tooFast"
  | "phoneTaken"
  | "sendFailed"

export type PhoneCodeLabels = Record<PhoneCodeProblem, string> & {
  phone: string
  phoneHelp: string
  sendCode: string
  sendingCode: string
  code: string
  codeSentTo: (phone: string) => string
  verify: string
  checking: string
  newCode: string
  changePhone: string
}

// Better Auth's answer (its phone-number plugin's error codes, and 429 from
// its rate limit) as the line the person reads.
function problemFor(error: {
  status: number
  code?: string
}): PhoneCodeProblem {
  if (error.status === 429) return "tooFast"
  if (error.code === "OTP_EXPIRED" || error.code === "OTP_NOT_FOUND") {
    return "expiredCode"
  }
  if (error.code === "TOO_MANY_ATTEMPTS") return "tooManyTries"
  if (error.code === "INVALID_OTP") return "wrongCode"
  if (error.code === "PHONE_NUMBER_EXIST") return "phoneTaken"
  return "sendFailed"
}

// Better Auth's phone-number plugin sends 6 digits (its otpLength).
const CODE_LENGTH = 6

const noChanges = () => () => {}

// The phone the person just booked with, if this tab has it.
function bookedPhone(): string {
  try {
    return sessionStorage.getItem(BOOKED_PHONE_KEY) ?? ""
  } catch {
    return ""
  }
}

// A phone, then the code sent to it on WhatsApp
// (better-auth.com/docs/plugins/phone-number). "signIn" signs in, making an
// account for a new phone; "addPhone" adds the phone to the signed-in
// account. `onDone` runs after the right code.
export function PhoneCodeForm({
  purpose,
  onDone,
  labels: t,
  locale,
  disabled = false,
  autoFocus = false,
}: {
  purpose: "signIn" | "addPhone"
  onDone: () => void | Promise<void>
  labels: PhoneCodeLabels
  locale: string
  disabled?: boolean
  autoFocus?: boolean
}) {
  const remembered = useSyncExternalStore(noChanges, bookedPhone, () => "")
  const [typed, setTyped] = useState<string | null>(null)
  const phone = typed ?? remembered
  const [step, setStep] = useState<"phone" | "code">("phone")
  const [code, setCode] = useState("")
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<PhoneCodeProblem | null>(null)
  const busy = sending || disabled

  const sendCode = async () => {
    const { error } = await authClient.phoneNumber.sendOtp({
      phoneNumber: phone,
    })
    if (error) {
      setProblem(problemFor(error))
      return
    }
    setCode("")
    setStep("code")
  }

  const verify = async (value = code) => {
    const { error } = await authClient.phoneNumber.verify({
      phoneNumber: phone,
      code: value,
      updatePhoneNumber: purpose === "addPhone",
    })
    if (error) {
      setProblem(problemFor(error))
      return
    }
    await onDone()
  }

  // One request at a time, starting from a clean slate.
  const run = async (work: () => Promise<void>) => {
    if (busy) return
    setProblem(null)
    setSending(true)
    try {
      await work()
    } catch {
      setProblem("sendFailed")
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void run(step === "phone" ? sendCode : () => verify())
      }}
      noValidate
    >
      <FieldGroup>
        {step === "phone" ? (
          <Field data-invalid={problem ? true : undefined}>
            <FieldLabel htmlFor="phone-code-phone">{t.phone}</FieldLabel>
            <PhoneInput
              id="phone-code-phone"
              value={phone}
              onChange={setTyped}
              locale={locale}
              autoComplete="tel"
              autoFocus={autoFocus}
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
            <FieldLabel htmlFor="phone-code-code">{t.code}</FieldLabel>
            {/* shadcn's InputOTP: one box per digit, the phone's keyboard
                and SMS autofill, and it checks itself once full. */}
            <InputOTP
              id="phone-code-code"
              maxLength={CODE_LENGTH}
              pattern={REGEXP_ONLY_DIGITS}
              value={code}
              onChange={setCode}
              onComplete={(value: string) => void run(() => verify(value))}
              autoComplete="one-time-code"
              disabled={busy}
              autoFocus
              containerClassName="w-full"
            >
              <InputOTPGroup className="w-full">
                {Array.from({ length: CODE_LENGTH }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    aria-invalid={problem ? true : undefined}
                    className="h-12 flex-1 text-lg"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
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
          disabled={
            busy || (step === "phone" ? !phone : code.length < CODE_LENGTH)
          }
        >
          {sending && <Spinner data-icon="inline-start" />}
          {step === "phone"
            ? sending
              ? t.sendingCode
              : t.sendCode
            : sending
              ? t.checking
              : t.verify}
        </Button>
        {step === "code" && (
          <ButtonGroup className="w-full">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                setProblem(null)
                setStep("phone")
              }}
            >
              {t.changePhone}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => void run(sendCode)}
            >
              {t.newCode}
            </Button>
          </ButtonGroup>
        )}
      </FieldGroup>
    </form>
  )
}
