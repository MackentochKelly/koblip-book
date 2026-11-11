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
| Other identities | `printdura.com` (verified), `upra.space` (not verified), one personal email address: other businesses, not touched |

## Still to look at

- Which SES keys the live server uses today (`SMTP_*` in `.env.production`).
- Whether Book's sends show up under a configuration set: none named for Book, so today Book's bounces reach only the suppression list.
