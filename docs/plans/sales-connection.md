# Sales connection

Koblip Sales sells Koblip Book. Sales finds a business on Google Maps, asks Book for an invite link, and sends it to the owner on WhatsApp. The owner opens it, sees their business ready on the sign-up page, and signs up. Book tells Sales what happened, so the lead moves on its own.

**Status (Nov 7):** Built and checked on this Mac, both apps. Nothing committed or pushed (owner's choice). The WhatsApp template is a draft only, not sent to Meta (SC9).

## How it works

1. Sales has the lead's Google place ID (`leads.external_place_id`).
2. Sales calls Book: `POST /api/partner/v1/invites` with the place ID and its own lead id. Book answers with one invite link (`/start/<code>`).
3. Sales sends it on WhatsApp.
4. The owner opens it. Book imports the place, the same import the home page uses, and opens the sign-up page with their business on it. They sign up, and the page is theirs.
5. Book sends Sales signed events: `invite.opened`, `invite.claimed` and `plan.started`. Sales updates the lead.

## Decisions

- **SC1. A public partner API, not a Sales-only one.** Book exposes `/api/partner/v1/…` that any approved app could use, and Sales uses it like any other app, the same rule Book follows with Chat. Nothing in Book knows Sales by name. Sales never reads Book's database.
- **SC2. One key per app.** Each partner app gets an API key, sent as `Authorization: Bearer`. Book stores only its SHA-256 hash, in server code only. Admin makes and revokes keys, and sees the key once, when it's made. The key lives in Sales's `backend/.env` only.
- **SC3. An invite keeps only the place ID.** Google's [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) (read Nov 7) let an app store a place ID indefinitely, but not names, addresses or reviews. So an invite stores the place ID and nothing else from Google. Nothing is imported until the owner opens the link. The import then follows today's rules: an import nobody claims is deleted after `ONBOARDING_RULES.unclaimedImportHours`, and opening the link again imports it again. *Changed Nov 7 from "Book makes the page at once and keeps it 30 days": that would have stored Google content Google doesn't allow.*
- **SC4. One link, ending after 30 days.** Sales gets one invite link, not a page link plus a claim link. The page link doesn't exist before the import. An invite ends after `PARTNER_RULES.inviteDays` (30), and once its business has an owner it opens the business's page.
- **SC5. Only leads you contact.** Sales asks for an invite only when it's about to send it, never for a whole map search. A daily cap per app (admin-set, `PARTNER_RULES.defaultDailyInvites` at first) limits Google cost and misuse. The same place asked for twice by one app gives back the same invite while it's open.
- **SC12. Opening the page changes nothing.** WhatsApp fetches a link to draw its preview, so `/start/<code>` only shows a page; its one button ("Make my page") imports the business and counts as `invite.opened`. Logged Nov 7.
- **SC6. The link is the proof.** The code is 32 random bytes, and Book stores only its hash. It reaches only the WhatsApp number Sales sends it to. Claiming still goes through the normal sign-up and the normal claim rule (`features/dashboard/api/claim.ts`). A real ownership check for every claim is app-wide work, outside this plan.
- **SC7. Events back, signed.** Book posts events to the app's webhook URL, signed like Chat's events to Book: HMAC-SHA256 of `timestamp + "." + body` with the app's own event secret, headers `x-koblip-signature: sha256=<hex>` and `x-koblip-timestamp`. Each event is stored first, then the server's timer sends it and retries a failure later (`PARTNER_RULES.retryMinutes`) until `PARTNER_RULES.maxAttempts`. Body: `{ id, type, createdAt, data: { inviteId, ref, slug?, plan? } }`. Event `id` lets the receiver drop repeats.
- **SC8. Sales's old booking pages stay.** Sales has its own booking pages (`booking_pages`, from the old Koblip). They are not merged or removed now. Sales gets a "Koblip Book invite" next to them; what happens to the old ones is decided later, by the owner.
- **SC9. WhatsApp words need a yes.** The message Sales sends with the link is a WhatsApp template. Its words are written as a draft and go to Meta only on the owner's yes.
- **SC10. Nothing hidden.** Book's admin gets a Partners screen: apps (key, webhook, cap, revoke), invites (state, opened, claimed, ends) and event deliveries.
- **SC11. Shared code for the hooks.** The claim (dashboard) and a started plan (billing) both add events, and features never import each other, so the event queue lives in `lib/partner-events.ts`.

## Tasks

Book tasks (`B`) are in this repo. Sales tasks (`S`) are in `koblip-sales`, against the contract in SC1–SC7.

| ID | Task | Needs | Files it owns | Status |
| --- | --- | --- | --- | --- |
| SC-B1 | Partner apps: tables (apps, invites, events), migration, rules, admin Partners screen to add an app, revoke it, set its cap | – | `lib/db/schema.ts` (partners), `drizzle/`, `lib/partner-rules.ts`, `features/admin/` (partners) | Done (Nov 7, not committed): admin Partners screen checked on phone, light and dark |
| SC-B2 | `POST /api/partner/v1/invites` and `GET /api/partner/v1/invites/<id>`: key check, cap, place ID check, one open invite per app and place | SC-B1 | `app/api/partner/v1/`, `features/partners/` | Done (Nov 7, not committed): admin Partners screen checked on phone, light and dark |
| SC-B3 | `/start/<code>`: check the code, mark opened, import, open the sign-up page; an ended invite opens the home page, a claimed one the business page | SC-B2 | `app/(public)/start/`, `features/partners/api/open-invite.ts` | Done (Nov 7, not committed): tested, and called live with a real key |
| SC-B4 | Events: queue, claim and plan hooks, signed sends on the timer, retries, admin list | SC-B1 | `lib/partner-events.ts`, `features/dashboard/api/claim.ts`, billing's plan start, `features/dashboard/api/notification-timer.ts` | Done (Nov 7, not committed): admin Partners screen checked on phone, light and dark |
| SC-S1 | Sales: Book settings in `backend/.env`, "Koblip Book invite" on a lead, the link saved on the lead | SC-B2 | `koblip-sales`: Book invites service, lead schema, lead panel | Done (Nov 7, not committed): tested, and called live with a real key |
| SC-S2 | Sales: the WhatsApp template draft with the link (SC9) | SC-S1 | `koblip-sales`: WhatsApp templates | Done (Nov 7, not committed): local drafts `koblip_book_invite` en and es, button "Make my page" to `https://koblip.com/start/{{1}}`; not submitted, words need the owner's yes |
| SC-S3 | Sales: receive Book's events, check the signature, move the lead | SC-B4 | `koblip-sales`: webhook route, lead stages | Done (Nov 7, not committed): tested (signing, claim by link and by place, Pro, retries) |
| SC-C | Checks: both apps end to end on this Mac, phone and computer, light and dark, typecheck, lint, tests, build | all | – | Done (Nov 7): invite made from a Sales lead, opened on Book, `invite.opened` delivered and shown as "Opened". Book: typecheck, lint, 2003 tests, clean build pass. Sales: typecheck, 2901 tests pass. Fixed on the way: Sales's Leads panel dropped the lead's place ID, so place sections never showed there |

Order: SC-B1 → SC-B2 → SC-B3 → SC-B4 → SC-S1 → SC-S2 → SC-S3 → SC-C.
