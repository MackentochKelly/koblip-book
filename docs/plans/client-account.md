# Client account

A client's own area in the app, built like the owner dashboard and the team area, ready for the client features coming next. It grows out of My bookings ([customer-accounts.md](customer-accounts.md)).

**Status (Nov 6):** C1–C7 and C9 built. C8: typecheck, lint and tests pass; phone pages checked in light. Left: computer and dark, Spanish, build. Next: C10–C18 below.

## What the client gets

| Menu | What it holds |
| --- | --- |
| **Bookings** | Upcoming and past bookings at every business: move, "Can't make it", book again. Today's My bookings list, moved in. |
| **Profile** | Photo, name, phone (add or change with a WhatsApp code), email. |
| **Settings** | Language, light or dark, log out, delete account. |

Phone: a tab bar at the bottom. Computer: the menu in a sidebar. The account menu (photo at the bottom of the sidebar) has the same Settings, Appearance, Language and Log out as the owner's.

## Decisions

- **D1. One shell for every area.** The owner area, the team area and the client area share one `AppShell` in `components/` (sidebar, top bar, tab bar, account menu). Each area only passes its menu items. Today the team area copies the owner's layout by hand; it moves onto the shared shell in C1, so all three stay the same.
- **D2. The menu is one list.** The client's menu lives in one config file (`features/customer-account/nav.ts`). A new client feature is one new entry plus its page.
- **D3. Address.** The area is `/account` (Bookings), `/account/profile` and `/account/settings`. `/my-bookings` and its reschedule links redirect there, so links already sent keep working.
- **D4. Same pieces as the owner.** Profile and Settings reuse the owner's shared parts: `PageSection`, `Item`, `PhotoUpload`, `PhoneCodeForm`, `ConfirmDialog`, the account menu. The client area doesn't get its own copies of them.
- **D5. Who sees it.** Any signed-in account (not a demo guest). Signed out goes to the one login page and comes back. Someone who is also an owner or team member sees "My bookings" in their account menu, and the client area links back to their dashboard.
- **D6. Words.** Every label is in the shared translations (`public.account`), English first and Spanish, Portuguese and French from the translation sync. Nothing is typed into a page.
- **D7. Delete account.** Deletes the person's login and unlinks their bookings (the business keeps its booking history), after a confirm. This is the same rule as the owner's delete, minus the businesses.
- **D9. Top bar.** Every app area's top bar ends with its bell, a short line and the account photo (shared `TopBarAccount`), so a phone shows them too. Done Nov 6 (3c759eb).
- **D10. Client notifications.** The client gets a bell like the owner's: the same bell, list and sheet (`features/notifications`, its provider takes `audience`). One table for both: `in_app_notifications.audience` is `owner` or `client`, and a client one keeps its `bookingId`; whose bell it is gets worked out when the bell asks (`ownBookings`), so a booking joined to an account later (claim, or a phone proved later) shows there too. Kinds: booked for you (the business made it), moved by the business, cancelled by the business, and a reminder `clientReminderMinutes` before the visit (admin rule, 24 h at first; the server's timer adds it). A customer's own actions never notify themselves. Saved only when an account can own the booking. Each opens `/account`. The client turns kinds off in Settings (`client_notification_settings`). Admin lists them with the owner's, filterable by kind.

## Tasks

1. **C1. Shared `AppShell`.** Pull the sidebar + top bar + tab bar + account menu into `components/app-shell.tsx`, and move the team area onto it. The owner dashboard moves onto it too if nothing changes on screen. Check: every team and owner page looks the same as before.
2. **C2. Client area shell.** `app/(customer)/account/layout.tsx` with the shell and the menu from `nav.ts`. Signed-out and guest visitors go to login.
3. **C3. Bookings page.** My bookings moves to `/account`, with the claim from "Manage your booking". `/my-bookings` redirects there. "Book again" opens the business's page.
4. **C4. Profile.** Photo, name, email shown, and phone added or changed with a code (`PhoneCodeForm`), so bookings made with that phone show up.
5. **C5. Settings.** Language and appearance (the owner's account menu controls), log out, and delete account (D7).
6. **C6. Links in.** "Manage your booking", the WhatsApp messages' links and the owner/team account menus point to `/account`.
7. **C7. Admin.** Admin → Users shows each account's phone and how many bookings it has (every stored record has an admin screen).
8. **C8. Checks.** Phone (375px) and computer, light and dark, English and Spanish, the UI checklist, typecheck, lint, tests, build.
9. **C9. Client bell (D10).** Done Nov 6: migration 0065, `/api/account/notifications`, events in the owner's book / move / cancel, reminders on the timer, the bell in the client top bar, the choices in Settings, admin kinds and rule.

## Next: client features (planned Nov 6, owner approved all five)

Same rules as above: shared parts only (`PageSection`, `Item`, `Empty`, `BottomPanel`, `ResponsivePanel`, `ConfirmDialog`, shadcn from `components/ui`), words in `public.account` (English first, the sync translates), every stored record and rule gets an admin screen, phone first, light and dark.

### Decisions

- **D11. One booking, one page.** `/account/bookings/[bookingId]` shows the visit: business (name, photo, address with a Maps link), service, team member, day and time in the business's time zone, price, the note, and the status. Actions: Add to calendar, Move, Can't make it, and Book again once it's past. It only opens for a booking the account owns (`ownBookings`); anyone else gets 404. A row in Bookings and every client notification open it (`link` becomes `/account/bookings/<id>`; old rows keep `/account`).
- **D12. Add to calendar.** One `.ics` file per booking from a Route Handler (`/api/account/bookings/[bookingId]/calendar`), the open standard every calendar app reads (RFC 5545), plus a Google Calendar link. Nothing is stored and no Google sign-in is needed. A `DropdownMenu` offers the two ways.
- **D13. My places.** A new menu item, Places (`/account/places`), lists every business the account has booked, the most recent first: photo, name, last visit, and "Book again" (the business page with the last service picked). Nothing new is stored: it's worked out from the account's bookings. Favourites can come later.
- **D14. Empty state.** Bookings with nothing in it shows its title and one button, "Find a business", opening the home page search. The same applies to Places.
- **D15. Reviews.** After a visit marked `completed` (or `confirmed` and over by a day), the client can rate it once: 1–5 stars and an optional short comment (`reviewRules.maxComment`, admin-editable). One review per booking, editable for `reviewRules.editDays` days. The business page shows the average and the latest reviews, with the client's first name only. The owner sees every review in the dashboard (Customers → Reviews) and can hide one from the page with a reason (never edit it). The client gets a bell alert (`clientReviewAsk`) when a visit can be reviewed. Admin sees all reviews, hidden ones too. Table `reviews` (bookingId unique, businessId, userId, stars, comment, hiddenAt, hiddenReason, timestamps).
- **D16. How to be reminded.** In Settings, the client picks how reminders reach them: WhatsApp, email, or the bell only (the bell always gets them). Stored per account (`client_reminder_channel`). WhatsApp still needs the booking's opt-in (Meta's rule), and email goes to the account's email through `lib/email.ts`. The business's own WhatsApp reminders go on as today. Email reminders are sent by the server's timer, once per booking and move, like the bell's.

### Tasks

| ID | Task | Needs | Files it owns | Status |
| --- | --- | --- | --- | --- |
| C10 | Empty states (D14): Bookings gets "Find a business" | – | `features/customer-account/components/my-bookings-list.tsx`, `lib/i18n/en/public.ts` (account) | To do |
| C11 | Booking page (D11): route, query, page, rows link to it | – | `app/(customer)/account/bookings/`, `features/customer-account/api/booking.ts`, `features/customer-account/components/booking-page.tsx` | To do |
| C12 | Notifications open the booking (D11) | C11 | `lib/in-app-notifications.ts` (`CLIENT_LINK`) | To do |
| C13 | Add to calendar (D12): `.ics` route and the menu on the booking page | C11 | `app/api/account/bookings/`, `lib/booking-calendar.ts` | To do |
| C14 | My places (D13): query, page, menu item, empty state | C10 | `app/(customer)/account/places/`, `features/customer-account/api/places.ts`, `features/customer-account/components/places-list.tsx`, `features/customer-account/nav.ts` | To do |
| C15 | Reviews, data (D15): table, migration, rules, save/edit action, bell ask on the timer, admin list | C11 | `lib/db/schema.ts` (reviews), `drizzle/`, `lib/review-rules.ts`, `features/reviews/api/`, `features/admin/` (reviews screen) | To do |
| C16 | Reviews, screens (D15): stars on the booking page, owner's Reviews tab with hide, average and latest on the business page | C15 | `features/reviews/components/`, the owner Customers page, `features/business-page/` (reviews section) | To do |
| C17 | Reminder channel (D16): setting, email reminders on the timer, admin view | – | `lib/db/schema.ts` (channel), `drizzle/`, `features/customer-account/components/settings-form.tsx`, `lib/client-reminders.ts` | To do |
| C18 | Checks: phone and computer, light and dark, English and Spanish, typecheck, lint, tests, build | all | – | To do |

Order: C10 → C11 → C12 + C13 → C14 → C15 → C16 → C17 → C18.
