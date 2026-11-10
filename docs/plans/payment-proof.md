# Payment proof

A customer who paid the business outside the app (bank transfer, Zelle, Cash App, another way) can add a picture of the payment when they say "I've paid". The owner sees it next to "Mark as paid". Follows [Pay outside the app: follow-ups](outside-payments.md).

**Status (Nov 10):** Plan only. Nothing built. Waiting for the owner's go and the answers under "Needs the owner".

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
- **PP2. Who can see a proof.** The customer who booked, the business's owner, and the app admin. Not team members (same line as OP3: they see the status, not the details). Not the assistant: it may say a proof was added, it never receives the picture.
- **PP3. One proof per booking, optional.** The owner decides per business whether it is asked for (PP6). The reference text stays as it is.
- **PP4. It can be replaced until the owner answers.** While the booking is "reported" the customer may replace or remove the picture. Once it is paid, the proof is locked. If the owner turns it back to "not paid", the old proof is deleted with the reference (as `setBookingPaid` already clears the reference) and the customer can send a new one.
- **PP5. Kept, then deleted.** A proof is deleted when the booking, the business or the customer's account is deleted, and by a timer 90 days after the booking's date (`PAYMENT_RULES.proofKeepDays`). Why: it is someone's financial data, kept only as long as it is useful (GDPR Article 5: storage limitation).
- **PP6. A switch for the owner.** Settings → Payments gets one switch, "Ask for a picture of the payment", with two states: **off**, or **on** (the customer may add one, it is not forced). Default: on. A required proof is left out of this plan; see "Needs the owner".
- **PP7. Same checks as other photos.** JPG, PNG, WebP, real type checked, 4 MB (`UPLOAD_RULES`). The picture is re-encoded on save, which strips location and device data from the file. PDF receipts are left out of this plan.
- **PP8. No judging.** The app does not read the picture, match amounts or detect fakes. It is shown to the owner, who decides.

## Tasks

In order. Each is small and ends with its own tests. All `To do`.

| ID | Task | Done when |
| --- | --- | --- |
| PP-1 | Private store | `lib/payment-proofs.ts`: save (checks type and size, re-encodes), read, delete, in its own folder. Tests: wrong type and too big refused; a saved name cannot be reached through `/uploads/`. |
| PP-2 | Data | `bookings.payment_proof` (the file's name) and `payment_proof_at`; `businesses.payment_proof` (the switch, default on). One migration, new fields only. |
| PP-3 | The door | `GET /api/payment-proof/[bookingId]`: answers the customer who booked, the owner of that business, or an admin; everyone else gets 404. `private, no-store`, `nosniff`. Tests: each of the three is let in; another customer, another owner, a team member and a signed-out visitor are not. |
| PP-4 | Customer: add it | The "I've paid" form gets the shared upload button, "Add a picture of your payment". Sent with the reference in one step. Shows a small preview with Replace and Remove while it is "reported". Phone first: the button opens the photo library or camera. |
| PP-5 | Owner: see it | Booking details show a thumbnail under the reference; a tap opens it full size in a dialog. With none: nothing extra shows. "Review payment" rows get a small "has picture" mark. |
| PP-6 | Owner: the switch | "Ask for a picture of the payment" in Settings → Payments, shown when the business has a way to pay. Off hides the upload button for its customers. |
| PP-7 | Clean-up | Proof deleted when the owner turns a booking back to "not paid", and with the booking, the business, the customer's account and the demo purge. Timer deletes proofs 90 days after the booking's date. Tests for each. |
| PP-8 | Admin | Admin → Bookings shows whether a booking has a proof and opens it (admin only). Nothing hidden from the admin. |
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
- A proof that is **required** before the booking is accepted.
- Proof added by a guest who is not signed in. "I've paid" already needs the customer's account.

## Risks

- **Private data.** The whole plan turns on PP1 and PP3: if a proof were ever served from `/uploads/`, it would be public and cached. The test in PP-1 guards this.
- **Disk space.** Up to 4 MB per booking. The 90-day timer and re-encoding keep it bounded. The live server's uploads folder must be included in backups, or proofs are lost with the server.
- **Live server.** A new folder (`PAYMENT_PROOFS_DIR`) must exist and be writable after deploy ([deploy](deploy.md)). Nginx must not serve it directly.

## Needs the owner

- **Go** to build PP-1 to PP-10.
- **Required or optional?** Planned: optional, with the owner's switch to turn asking on or off. Say if a business should be able to make it required.
- **How long to keep proofs.** Planned: 90 days after the booking's date.
- **Team members.** Planned: they do not see proofs. Say if a member should see the proof on their own bookings.
- **Wording**, to approve before it ships: "Add a picture of your payment", "Replace", "Remove", "Ask for a picture of the payment", "Customers can add a screenshot when they say they paid.", "Payment picture".

## Next step

Owner answers the five points above. Then PP-1.
