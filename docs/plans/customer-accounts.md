# Customer accounts

Every customer who booked can sign in with the phone they booked with and a code, no email, and see their bookings at every business. "Manage your booking" on the "You're booked" screen opens it.

## Built (step 1)

- Sign-in: `lib/customer-auth.ts`, a second Better Auth instance with the phone-number plugin, at `/api/customer-auth`.
- Pages: `/my-bookings/sign-in` (phone, then code) and `/my-bookings` (upcoming, then past; each opens the business page to book again).
- Profile: made on the first right code, named from the latest booking; bookings join it by the phone's digits (`lib/customer-key.ts`).
- "You're booked": "Manage your booking" replaces "Done" while sign-in is on; the phone is kept in the tab so sign-in opens filled in.

## Next

1. **Sign-in code on WhatsApp (needs the owner's yes).** An authentication template on Koblip's number, submitted to Meta by hand (Chat already supports the `AUTHENTICATION` category and its copy-code button). Until it is approved, only the dev server signs customers in, with the code in its log; production shows "Done" as before.
2. **Cancel from the account.** One shared customer-cancel step, used by both this page and the WhatsApp "Can't make it" tap, so both tell the owner, the bell and Google Calendar the same way.
3. **Admin screen** listing customer accounts (every stored record gets one).

## Decisions

- **D1. Separate from owners' sign-in.** Own tables (`customer_*`), address and cookie prefix (`koblip-customer`): a customer's session never opens the dashboard, and an owner testing their own page keeps their session. Fresha and Booksy keep customer and business accounts apart the same way.
- **D2. Codes only go to phones that booked.** Any other phone gets nothing, and the screen looks the same either way, so no one can learn whether a number booked, and WhatsApp costs can't be run up.
- **D3. Limits.** A code works for 5 minutes and 3 tries; a device may ask for 3 codes a minute; a session lasts 30 days.
- **D4. Placeholder email.** Better Auth needs one; it is `<digits>@phone.invalid` (a reserved domain, RFC 2606), never mailed.
- **D5. Google photos are not stored** (Google's terms), so a booking shows the business's own first photo, else the shop icon.
