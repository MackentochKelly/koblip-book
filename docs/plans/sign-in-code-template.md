# Sign-in code template (draft)

The WhatsApp message that carries phone sign-in codes ([customer-accounts.md](customer-accounts.md), Next 1).

**Status (Nov 5): blocked by Meta.** The owner said yes and it was submitted from Koblip's workspace (WABA 2325968508142257). Meta refused with code 10, subcode 2388185: "This WhatsApp business account does not have permission to create message template". Meta only allows `AUTHENTICATION` templates for verified businesses (some reports also mention a daily message volume). Nothing was saved in Chat. Meta's own check of the account on Nov 5: the WhatsApp account "Koblip Chat Demo" (+1 849-880-0293) belongs to the business portfolio "Koblip Agency" (id 6307536809360263), which shows `business_verification_status: not_verified` (health error 141010, "The Business has not passed business verification"). If another portfolio was verified, it is not this one. Next: verify the business in Meta Business Manager (Security Center → Business verification), then submit again. Sending codes in a `UTILITY` template instead would break Meta's rules, so it isn't an option.

## The template

| Field | Value |
| --- | --- |
| Name | `koblip_sign_in_code` |
| Category | `AUTHENTICATION` |
| Languages | `en`, `es` (the same two as the booking templates) |
| Sent from | Koblip's own WhatsApp number, not a business's |
| Body | Meta's fixed text, which can't be changed: "*{{1}}* is your verification code.", plus its line asking people not to share the code |
| Footer | "This code expires in 5 minutes." (Meta's wording; 5 matches `PHONE_SIGN_IN_RULES.codeMinutes`) |
| Button | Copy code (works on every phone; one-tap autofill needs an Android app, which Koblip doesn't have) |

Source: [Meta, authentication templates](https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates).

## What gets submitted

```json
{
  "name": "koblip_sign_in_code",
  "languages": ["en", "es"],
  "category": "AUTHENTICATION",
  "components": [
    { "type": "BODY", "add_security_recommendation": true },
    { "type": "FOOTER", "code_expiration_minutes": 5 },
    {
      "type": "BUTTONS",
      "buttons": [{ "type": "OTP", "otp_type": "COPY_CODE" }]
    }
  ]
}
```

## After Meta approves it

1. `lib/phone-sign-in.ts`: `phoneCodeDelivery()` returns `"whatsapp"` in production, and `sendPhoneCode` sends the template through Chat's public API, with the code as the body value and the copy-code button value, in the person's language.
2. The phone option, My bookings and "Manage your booking" then show on the live site by themselves.
3. Meta bills each authentication message; the limit of 3 codes a minute per device keeps that down.
