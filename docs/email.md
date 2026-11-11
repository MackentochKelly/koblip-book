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
| Configuration sets | `flowlead-production`, `koblip-sales-production`, `my-first-configuration-set`, and Book's `koblip-book-production` (Nov 11) |
| `contact@koblip.com` | The sender (owner's call, Nov 11). Covered by the verified `koblip.com` domain, so SES sends from it as is. Not on the suppression list (all 18 entries checked). A real Hostinger mailbox, so replies reach a person. Already the app's legal contact (`features/legal/content.ts`) |
| DMARC today | Passes through DKIM: mail from `contact@koblip.com` is signed by `koblip.com`, the same domain. The custom MAIL FROM would also line up SPF; it is optional and not set up |
| Other identities | `printdura.com` (verified), `upra.space` (not verified), one personal email address: other businesses, not touched |

## How Book sends (EM-3, EM-4)

- `lib/email.ts` sends through the SES API (nodemailer's SES transport, `@aws-sdk/client-sesv2`). Every email gets an `email_sends` row first: kind, address, business, booking, state (`sending → sent | failed | skipped`), Amazon's message id.
- An address in `email_blocks` is skipped with the reason `blocked`. Without the AWS keys, emails are skipped with `notSetUp` and one warning.
- `SES_CONFIGURATION_SET` puts each email in that set; its SNS topic posts to `/api/email/events`. The route checks Amazon's signature, the topic (`SES_EVENTS_TOPIC_ARN`) and the certificate host, confirms the subscription once, and records Delivery, DeliveryDelay, Reject, Bounce and Complaint. A hard bounce or a complaint blocks the address everywhere.

## Book's AWS pieces (made Nov 11, EM-5)

| Piece | Name | What it does |
| --- | --- | --- |
| Configuration set | `koblip-book-production` | Every Book email goes out in it (`SES_CONFIGURATION_SET`). Sends Rejects, Deliveries, Hard bounces, Complaints and Delivery delays to the topic |
| SNS topic | `koblip-book-ses-events`, ARN `arn:aws:sns:us-east-1:175646932741:koblip-book-ses-events` | `SES_EVENTS_TOPIC_ARN`. Standard topic |
| Subscription | HTTPS to `https://book.koblip.com/api/email/events`, raw delivery off | Confirmed by the live app on Nov 11 |
| IAM user | `koblip-book-email`, inline policy `KoblipBookEmailAccess` | Can only send (`ses:SendEmail`, `ses:SendRawEmail`) on `koblip.com` with that set, from `contact@koblip.com`. No console access. Its key is in `.env.local` and the server's `.env.production` |

## Checked live (Nov 11)

Sent from the server to Amazon's mailbox simulator in `koblip-book-production`: `bounce@`, `complaint@` and `success@simulator.amazonses.com`. SNS posted each event to `/api/email/events` (all answered 204), and the bounce and the complaint each put their address in `email_blocks` for every business.

## Still to look at

- The server's `.env.production` still has the old `SMTP_*` values; the app no longer reads them. The IAM user `koblip-ses` that they likely came from can be retired once nothing else uses it.
- The live `EMAIL_FROM` is `"Koblip Book <contact@koblip.com>"` (kept as it was); `.env.example` and local use `Koblip <contact@koblip.com>`.
