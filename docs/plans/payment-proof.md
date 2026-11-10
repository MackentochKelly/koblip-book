# Payment proof

A customer who paid the business outside the app (bank transfer, Zelle, Cash App, another way) can add a picture of the payment when they say "I've paid". The owner sees it next to "Mark as paid". Follows [Pay outside the app: follow-ups](outside-payments.md).

**Status (Nov 10):** Built, PP-1 to PP-10, on the owner's go. Type check, lint, tests and build pass. Not checked on a phone screen yet, not pushed, not live. Spanish, Portuguese and French words fill in at the next server start.

## Rules that stay

- A payment is only **Paid** when the owner says so. A proof never marks anything paid by itself.
- Koblip never moves the money and never judges a proof. It only stores and shows it.
- A business with no ways to pay sees none of this. "Pay later" bookings have no proof.
- Same data and code in Luma and Nova. Tokens only. shadcn parts only.
- English words only; Spanish, Portuguese and French come from the translation run.

## What exists today

| Part | Today |
| --- | --- |
| "I've paid" | On the customer's own booking page, signed in (`features/customer-account/components/booking-payment.tsx`). Sends an optional reference text. Sets the booking to "reported" (`reportPayment`). |
| Owner | Booking details show the way, the status, the reference and "Mark as paid" (`features/dashboard/components/booking-details.tsx`). The owner's bell says "{who} says they paid". |
| Uploads | `lib/uploads.ts` saves JPG, PNG and WebP up to 4 MB in the uploads folder and checks the file's real type. Every file is **public**: `/uploads/<name>` answers anyone, cached for a year (`app/uploads/[file]/route.ts`). |
| Upload button | `components/photo-upload.tsx`, used for business, service, team and profile photos. |
| Data | Six `payment_*` fields on `bookings`. None for a picture. |

## The main problem

A proof is a screenshot of someone's bank or payment app: names, account numbers, amounts. Today's uploads are public by design, so a proof **cannot** go through `/uploads/`. It needs its own private store and its own door that checks who is asking.

## Decisions

- **PP1. Private files.** Proofs are saved in a separate folder (`data/payment-proofs`, set by `PAYMENT_PROOFS_DIR`), never under `/uploads/`. They are served only by a new route that checks the session on every request and answers `Cache-Control: private, no-store`.
- **PP2. Who can see a proof.** The customer who booked, the business's owner, the app admin, and the team member the booking is with (owner's decision, Nov 10), unless the business owner turns that off (PP9). A member never sees another member's bookings or proofs. Not the assistant: it may say a proof was added, it never receives the picture.
- **PP3. One proof per booking, required** (owner's decision, Nov 10). While the business asks for proofs (PP6), "I've paid" cannot be sent without a picture; the server refuses it too, not only the button. The reference text stays optional.
- **PP4. It can be replaced until the owner answers.** While the booking is "reported" the customer may replace or remove the picture. Once it is paid, the proof is locked. If the owner turns it back to "not paid", the old proof is deleted with the reference (as `setBookingPaid` already clears the reference) and the customer can send a new one.
- **PP5. Kept, then deleted.** A proof is deleted when the booking, the business or the customer's account is deleted, and by a timer 90 days after the booking's date (`PAYMENT_RULES.proofKeepDays`). Why: it is someone's financial data, kept only as long as it is useful (GDPR Article 5: storage limitation). The 90 days are said plainly where it matters (owner's decision, Nov 10): to the owner under the switch in Settings → Payments and beside each proof ("Deleted on {date}"), to the customer under the upload button, and in the app admin with each proof.
- **PP6. A switch for the owner.** Settings → Payments gets one switch, "Ask for a picture of the payment", with two states: **off** (no picture asked), or **on** (a picture is required to say "I've paid"). Default: on.
- **PP7. Same checks as other photos.** JPG, PNG, WebP, real type checked, 4 MB (`UPLOAD_RULES`). The picture is re-encoded on save, which strips location and device data from the file. PDF receipts are left out of this plan.
- **PP9. A second switch: team members.** Settings → Payments, "Team members see payment pictures", on by default, shown only while proofs are asked for. Off: members keep seeing the way and the status (OP3), not the picture. Read from the business on every request, so turning it off works at once. "Admin" in the owner's answer is read as the business owner; the app admin sees every proof either way.
- **PP10. Asked on the pay step, before the booking is confirmed** (owner's decision, Nov 10: "it should be on the checkout process, on the booking flow"). On "How you'll pay", picking a way to pay now shows where to send the money and "Add payment proof"; "Confirm" stays off until it is added, and the server refuses the booking without it. The booking then starts as "Being checked" and the owner's bell says both "new booking" and "says they paid". Paying later asks for nothing. Works signed out, like booking itself. Where to send the money is asked from the server only when a way is picked (`features/booking/api/payment-details.ts`), and only for a business that asks for proof: it is still never part of the public page. If the time was taken meanwhile, the proof is not kept on the server; it stays in the form for the next time picked. "I've paid" in Manage your booking stays for a business that turned proofs off, and for replacing a proof.
- **PP8. No judging.** The app does not read the picture, match amounts or detect fakes. It is shown to the owner, who decides.

## Tasks

In order. Each is small and ends with its own tests. All `Done` (Nov 10).

| ID | Task | Done when |
| --- | --- | --- |
| PP-1 | Private store | `lib/payment-proofs.ts`: save (checks type and size, re-encodes), read, delete, in its own folder. Tests: wrong type and too big refused; a saved name cannot be reached through `/uploads/`. |
| PP-2 | Data | `bookings.payment_proof` (the file's name) and `payment_proof_at`; `businesses.payment_proof` (the switch, default on) and `businesses.payment_proof_team` (team members see it, default on). One migration, new fields only. |
| PP-3 | The door | `GET /api/payment-proof/[bookingId]`: answers the customer who booked, the owner of that business, an admin, or the team member the booking is with while the business allows it; everyone else gets 404. `private, no-store`, `nosniff`. Tests: each of the four is let in; another customer, another owner, another team member, the right member with the switch off, and a signed-out visitor are not. |
| PP-4 | Customer: add it | The "I've paid" form gets the shared upload button, "Add a picture of your payment", required: the button stays off without one and `reportPayment` refuses it. One helper line: kept 90 days. Sent with the reference in one step. Shows a small preview with Replace and Remove while it is "reported". Phone first: the button opens the photo library or camera. |
| PP-5 | Owner: see it | Booking details show a thumbnail under the reference with "Deleted on {date}"; a tap opens it full size in a dialog. With none: nothing extra shows. "Review payment" rows get a small "has picture" mark. |
| PP-6 | Owner: the switches | In Settings → Payments, shown when the business has a way to pay: "Ask for a picture of the payment" (helper: required to say "I've paid", deleted after 90 days) and, under it, "Team members see payment pictures". Both on by default. |
| PP-6b | Team area | A member's own booking shows the proof's thumbnail and opens it, while the business allows it. `features/team-area/`. Tests: own booking yes, another member's no, switch off no. |
| PP-7 | Clean-up | Proof deleted when the owner turns a booking back to "not paid", and with the booking, the business, the customer's account and the demo purge. Timer deletes proofs 90 days after the booking's date. Tests for each. |
| PP-8 | Admin | Admin → Bookings shows whether a booking has a proof, opens it, and says when it will be deleted. Admin → Payments shows both switches per business and the 90-day rule. Nothing hidden from the admin. |
| PP-9 | Assistant | `list_bookings` says `hasProof: true/false`. No tool returns the picture. |
| PP-10 | Words and checks | New words translated; type check, lint, tests, build; phone (375 and 320) and computer, Luma and Nova, light and dark. |

### Where the code will go

| Part | Files |
| --- | --- |
| Store | `lib/payment-proofs.ts`, `lib/payment-rules.ts` (limits, keep days) |
| Door | `app/api/payment-proof/[bookingId]/route.ts` |
| Customer | `features/customer-account/api/report-payment.ts`, `components/booking-payment.tsx` |
| Owner | `features/dashboard/components/booking-details.tsx`, `payments-section.tsx`, `api/payment-actions.ts` |
| Clean-up | `features/dashboard/api/delete-businesses.ts`, `lib/auth.ts` (account deletion), `features/demo/api/purge-demos.ts`, the server's timer |
| Admin | `features/admin/components/bookings-list.tsx`, `features/admin/api/queries.ts` |

## Not in this plan

- Reading the picture (amount, date, name) or spotting fakes.
- PDF receipts, more than one picture per booking.
- Sending the proof over WhatsApp or email.

## Risks

- **Private data.** The whole plan turns on PP1 and PP3: if a proof were ever served from `/uploads/`, it would be public and cached. The test in PP-1 guards this.
- **Disk space.** Up to 4 MB per booking. The 90-day timer and re-encoding keep it bounded. The live server's uploads folder must be included in backups, or proofs are lost with the server.
- **Live server.** A new folder (`PAYMENT_PROOFS_DIR`) must exist and be writable after deploy ([deploy](deploy.md)). Nginx must not serve it directly.

## Needs the owner

- A look at it on the phone and the computer.
- Nothing on wording: the owner asked (Nov 10) for the short plain words big teams use instead of approving each line (`docs/ui-rules/forms-and-text.md`, "Words"). On screen it is "payment proof" (the owner's word, Nov 10): "Add payment proof", "Replace", "Ask for payment proof", "Team sees payment proof", "Deleted on {date}".

## Next step

The owner looks at it. On the live server, `PAYMENT_PROOFS_DIR` must exist and be writable before deploy.
