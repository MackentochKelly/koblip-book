# Email (Amazon SES)

How Koblip Book sends email, and what Amazon holds for it. The plan and its tasks: [plans/email.md](plans/email.md).

## The AWS account (looked at Nov 11, EM-1)

| Thing | What is there |
| --- | --- |
| Region | US East (N. Virginia), `us-east-1` |
| Sandbox | **No**: production access, 50,000 emails a day, 14 a second. Health: Healthy. 0 sent in the last 7 days |
| `koblip.com` | Verified domain. Easy DKIM on, 2048-bit, working |
| Custom MAIL FROM | **Not set up.** Amazon flags it: "MAIL FROM record is not aligned" (high). Mail goes out with an `amazonses.com` return path, so SPF does not line up with `koblip.com` |
| DMARC | `_dmarc.koblip.com` is `v=DMARC1; p=none;`: no reports asked for, nothing enforced |
| SPF on `koblip.com` | `include:_spf.mail.hostinger.com include:_spf.firebasemail.com include:amazonses.com ~all` |
| DNS | Hostinger (name servers `*.dns-parking.com`). Mailboxes on `koblip.com` are Hostinger's (MX `mx1/mx2.hostinger.com`) |
| Suppression list | On, for bounces and complaints. 10+ addresses, mostly old bounces; `admin@koblip.com` bounced on Jul 31 |
| Configuration sets | `flowlead-production`, `koblip-sales-production`, `my-first-configuration-set`. None for Book yet |
| `contact@koblip.com` | The sender (owner's call, Nov 11). Covered by the verified `koblip.com` domain, so SES sends from it as is. Not on the suppression list (all 18 entries checked). A real Hostinger mailbox, so replies reach a person. Already the app's legal contact (`features/legal/content.ts`) |
| DMARC today | Passes through DKIM: mail from `contact@koblip.com` is signed by `koblip.com`, the same domain. The custom MAIL FROM would also line up SPF; it is optional and not set up |
| Other identities | `printdura.com` (verified), `upra.space` (not verified), one personal email address: other businesses, not touched |

## How Book sends (EM-3, EM-4)

- `lib/email.ts` sends through the SES API (nodemailer's SES transport, `@aws-sdk/client-sesv2`). Every email gets an `email_sends` row first: kind, address, business, booking, state (`sending → sent | failed | skipped`), Amazon's message id.
- An address in `email_blocks` is skipped with the reason `blocked`. Without the AWS keys, emails are skipped with `notSetUp` and one warning.
- `SES_CONFIGURATION_SET` puts each email in that set; its SNS topic posts to `/api/email/events`. The route checks Amazon's signature, the topic (`SES_EVENTS_TOPIC_ARN`) and the certificate host, confirms the subscription once, and records Delivery, DeliveryDelay, Reject, Bounce and Complaint. A hard bounce or a complaint blocks the address everywhere.

## Still to look at

- Which SES keys and `EMAIL_FROM` the live server uses today (`.env.production`); it becomes `Koblip <contact@koblip.com>`.
- Whether Book's sends show up under a configuration set: none named for Book, so today Book's bounces reach only the suppression list.
