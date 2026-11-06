# Client account

A client's own area in the app, built like the owner dashboard and the team area, ready for the client features coming next. It grows out of My bookings ([customer-accounts.md](customer-accounts.md)).

**Status (Nov 6):** C1–C7 built. C8: typecheck, lint and tests pass; phone pages checked in light. Left: computer and dark, Spanish, build.

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
- **D10. Client notifications.** The client gets a bell like the owner's: the same bell, list and sheet (`features/notifications` components, fed by a provider that takes its feed address), one table for both with a recipient: a business (owner bell) or an account (client bell). Kinds for the client: booking made, confirmed by the business, moved by the business, cancelled by the business, reminder before the visit. Each opens the booking in `/account`. Only bookings linked to the account (`customerUserId`) get them. The client turns kinds off in Settings. Admin sees them with the owner ones.

## Tasks

1. **C1. Shared `AppShell`.** Pull the sidebar + top bar + tab bar + account menu into `components/app-shell.tsx`, and move the team area onto it. The owner dashboard moves onto it too if nothing changes on screen. Check: every team and owner page looks the same as before.
2. **C2. Client area shell.** `app/(customer)/account/layout.tsx` with the shell and the menu from `nav.ts`. Signed-out and guest visitors go to login.
3. **C3. Bookings page.** My bookings moves to `/account`, with the claim from "Manage your booking". `/my-bookings` redirects there. "Book again" opens the business's page.
4. **C4. Profile.** Photo, name, email shown, and phone added or changed with a code (`PhoneCodeForm`), so bookings made with that phone show up.
5. **C5. Settings.** Language and appearance (the owner's account menu controls), log out, and delete account (D7).
6. **C6. Links in.** "Manage your booking", the WhatsApp messages' links and the owner/team account menus point to `/account`.
7. **C7. Admin.** Admin → Users shows each account's phone and how many bookings it has (every stored record has an admin screen).
8. **C8. Checks.** Phone (375px) and computer, light and dark, English and Spanish, the UI checklist, typecheck, lint, tests, build.
9. **C9. Client bell (D10).** Table change + migration, the client feed route, the events where bookings change, the bell in the client top bar, the choices in Settings, admin. Waiting for the owner's go.
