# Customer accounts

Customers use the same account and the same login page as everyone else (`/login`): Google first, then "More options" for email or phone. My bookings shows the bookings made with the account's phone at every business. "Manage your booking" on the "You're booked" screen opens it.

## Built

- **One sign-in** (`lib/auth.ts`): Better Auth with Google, email and password, and the phone-number plugin (a code on WhatsApp). A new phone makes an account, named from its latest booking.
- **Login UI** (`features/owner-auth/components/auth-form.tsx`): "Continue with Google", then a "More options" menu (email, phone) whose pick unfolds under it. The code step is shadcn's `InputOTP` and checks itself once full (`components/phone-code-form.tsx`, shared).
- **My bookings** (`/my-bookings`): signed out → the one login page, coming back here; signed in → the account's bookings (D8). Upcoming bookings can be moved or cancelled.
- **"You're booked"**: "Manage your booking" replaces "Done"; the phone and the booking's claim are kept in the tab, so phone sign-in opens filled in and the booking joins the account.

## Next

1. **Sign-in code on WhatsApp (needs the owner's yes).** Drafted in [sign-in-code-template.md](sign-in-code-template.md). An authentication template on Koblip's number, submitted to Meta by hand (Chat already supports the `AUTHENTICATION` category and its copy-code button). Until it is approved, only the dev server offers phone sign-in, with the code in its log; production hides the phone option and My bookings, and shows "Done" as before.
2. **Admin screen** showing each account's phone (every stored record gets one).
3. **One account, two sign-ins.** A phone already on another account can't be added ("That phone is on another account"); merging two accounts is left for later.

## Decisions

- **D1 (replaced by D6). Separate customer sign-in.** Dropped on Nov 5: the owner wants one login page for the whole app.
- **D2 (replaced). Codes only to phones that booked.** Phone sign-in is now for any account, so any valid phone gets a code; the rate limit (D3) keeps WhatsApp costs down.
- **D3. Limits.** A code works for 5 minutes and 3 tries; a device may ask for 3 codes a minute.
- **D4. Placeholder email.** Better Auth needs one; an account made by phone gets `<digits>@phone.invalid` (a reserved domain, RFC 2606), never mailed and never shown: the app shows the phone instead (`OwnerSession.contact`).
- **D5. Google photos are not stored** (Google's terms), so a booking shows the business's own first photo, else the shop icon.
- **D6. One account for everyone** (M Kelly B, Nov 5). Owners, team and customers share `/login` and Better Auth's `user` table; phone sign-in is one shared feature. Migration `0051_one_sign_in` drops the `customer_*` tables (never deployed) and adds `phone_number` and `phone_number_verified` to `user`.
- **D7 (replaced by D8). Bookings join by the verified phone.** Dropped on Nov 6: the owner wants no "Add your phone" step, only the one login.
- **D8. Bookings join the account** (M Kelly B, Nov 6). Booked signed in, the booking is the account's (`bookings.customer_user_id`). Booked signed out, it gets a one-time secret kept in the tab (only its SHA-256 is stored); "Manage your booking" opens the one login page and My bookings claims it for the account logged in. My bookings also shows bookings made with the account's verified phone, and is open without phone codes.
