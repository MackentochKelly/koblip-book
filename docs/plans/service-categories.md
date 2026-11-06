# Service categories

Services grouped into categories (Hair, Nails…), the way Fresha does it:
owners group them on the Services screen, customers see them as sections
with tabs. A business with no category looks exactly as it does today.
Asked by the owner (2026-11-05), plan approved 2026-11-06. Each task starts
only after the owner's go.
How to use this file: [Plans](README.md).

## Rules that always apply

- "Category" already means the business's own type from Google
  (`businesses.category`, `features/place-import`, `scripts/fix-categories.ts`).
  The new thing is always a **service category** in code:
  `service_categories`, `categoryId`.
- A category is optional. A service with none is in **Other**, shown last.
- Removing a category never removes its services: they move to Other.
- Headings and tabs show only once the business has a category; tabs only
  with 2 or more groups.
- Category names are translated like service names (`translations`, by id).
- Limits in `lib/booking-rules.ts`: `maxServiceCategories` 20,
  `maxServiceCategoryName` 40. Names are unique per business, ignoring
  capitals.
- UI tasks start with `docs/ui-rules/checklist.md` and use only existing
  shared parts (`Item`, `DropdownMenu`, `ResponsivePanel`, `AppSelect`,
  `ViewTabs`, `FieldSet`, `ConfirmRemove`).

## How others do it

| Topic | What they do | Source |
| --- | --- | --- |
| Create, edit | Fresha: Add → Category (name, colour, description); Edit and "Add service" in the category's Actions menu. Booksy: + → Add Category. Vagaro: Add → Category, title, optional colour | [Fresha](https://www.fresha.com/help-center/knowledge-base/catalog/52-manage-service-categories-1), [Booksy](https://support.booksy.com/hc/en-us/articles/16538281912850-How-do-I-group-services-into-Categories), [Vagaro](https://support.vagaro.com/hc/en-us/articles/18977260870683-Add-a-Service-Category-or-Class-Category) |
| Assign | A Category drop-down in the service form | Booksy (above), [Fresha](https://www.fresha.com/help-center/knowledge-base/catalog/64-create-services-1) |
| Reorder | Fresha: drag categories and services, shown online in that order. Vagaro: up and down arrows | [Fresha](https://www.fresha.com/help-center/knowledge-base/catalog/73-order-your-service-menu), [Vagaro](https://support.vagaro.com/hc/en-us/articles/360010337114-Change-the-Order-of-the-Service-Menu) |
| Remove | Fresha removes the category's services too. Booxi moves them to a default category | Fresha (above), [Booxi](https://help.booxi.com/en/articles/6821654-how-to-delete-a-category-service-or-resource) |
| No category | Square: shown last, as "Other (Uncategorised Services)" | [Square](https://community.squareup.com/t5/Product-Updates/Square-Appointments-Display-Services-with-Categories-on-the/m-p/646764) |
| Public page | Fresha: tabs over the services ("Featured", then each category), a few cards, See all | [Fresha page](https://www.fresha.com/a/barbers-atelier-london-193-roman-road-x3umjoqq) |
| Colour | Fresha: a colour per category. Vagaro: it colours all the category's services on the calendar | Fresha, Vagaro (above) |
| Reports | Fresha's Sales summary groups by category | [Fresha](https://www.fresha.com/help-center/knowledge-base/reports/338-sales-summary-article-1) |

## Tasks

| Task | What | Needs | Status |
| --- | --- | --- | --- |
| C1 | This plan | | Done (2026-11-06) |
| C2 | Schema + migration: `service_categories` (id, business, name, position), `services.category_id` (null = Other, ON DELETE SET NULL); rules; actions to create, rename, remove, reorder; `createService`/`updateService` take `categoryId`; owner query returns categories; the one shared grouping helper `lib/service-groups.ts` (groups in order, Other last, empty groups left out for customers); every new EN/ES word below, in all word files; the `ServiceSuggestion` shape with its category; tests | C1 | Done (2026-11-06) |
| C3 | Owner Services screen: groups under category headings with ⋮ (Add a service, Edit, Move up, Move down, Remove), Other last; Add category (computer header, phone list foot); category panel; Category field in the service form; removal says services move to Other; the Suggest panel shows and saves each suggestion's category | C2 | Done (2026-11-06) |
| C4 | Public page and booking: category tabs over the service preview (team profile too); booking service step in sections with jump tabs (scroll-spy moves to `hooks/use-scroll-spy.ts`); category names in Spanish | C2 | Done (2026-11-06) |
| C5 | Owner pickers grouped by category: add-booking service, bookings Services filter, Extras "Offered with" | C2 | Done (2026-11-06) |
| C6 | Meta AI, server side only: the starter catalog gives each service a category (saved only with 2 or more), `replaceCatalog` clears old ones; `suggestServices` returns an existing or new category for each; demo sample grouped | C2 | Done (2026-11-06) |
| C7 | Assistant: `list_services` shows categories; `create_service`/`update_service` take one; confirm-card tools to create, rename, remove and reorder categories | C2 | Done (2026-11-06) |
| C8 | Admin "Service categories": every business's categories with their service count; Remove | C2 | Done (2026-11-06) |
| C9 | Optional: a category colour that becomes the Google Calendar colour of its services that have none | C3 | Decision |
| C10 | Optional: "Top categories" in Analytics | C2 | Decision |

## Build order (several builders, asked by the owner 2026-11-06)

1. C2 alone: everything else builds on it.
2. Then five builders at once, each only in its own files, none commits:
   C3 (`features/dashboard/components/services-view.tsx`, `list-footer.tsx`);
   C4 (`features/business-page`, `features/booking`, `hooks/use-scroll-spy.ts`,
   translation files); C5 + C8 (`add-booking-panel.tsx`, `bookings-table.tsx`,
   `extras-view.tsx`, `app/(admin)`, `features/admin`); C6
   (`features/starter-catalog`, `lib/starter-catalog-rules.ts`,
   `suggestServices` in `actions.ts`, `features/demo`); C7
   (`app/api/assistant`, `features/assistant`). Word files and
   `lib/service-groups.ts` are only read, never changed, in this phase.
   Each builder runs only its own tests.
3. One full run at the end (typecheck, lint, tests, build), the UI
   checklist at 375px and 1280px, light and dark, EN and ES, screenshots to
   the owner, then the commits.

## Words (approved by the owner, 2026-11-06)

| Where | English | Spanish |
| --- | --- | --- |
| Form field | Category | Categoría |
| Form option | No category | Sin categoría |
| Group with no category | Other | Otros |
| Button | Add category | Agregar categoría |
| Panel titles | Add a category · Edit category | Agregar una categoría · Editar categoría |
| Name placeholder | Haircuts | Cortes |
| Name taken | You already have this category | Ya tienes esta categoría |
| Toast | Category removed | Categoría quitada |
| Remove dialog line | Its services move to Other. | Sus servicios pasan a Otros. |
| Tabs label (screen readers) | Service categories | Categorías de servicios |
| Admin nav, empty, row | Service categories · No service categories yet · 3 services | Categorías de servicios · Aún no hay categorías de servicios · 3 servicios |

## Decisions log

| What | Why | Who, date |
| --- | --- | --- |
| Own `service_categories` table and a nullable `services.category_id`, not a text field | Renamed once, reordered and translated by id | M Kelly B, 2026-11-06 |
| A category is optional; no category = Other, last | Square's way; existing services need no backfill | M Kelly B, 2026-11-06 |
| Removing a category moves its services to Other | Fresha's way loses services | M Kelly B, 2026-11-06 |
| Name only, no description | Very-little-text rule; colour is C9 | M Kelly B, 2026-11-06 |
| Categories have their own position; services keep theirs, read inside their category; Move up and Move down in ⋮ menus | `reorderServices` keeps its contract; same as services today and Vagaro's arrows | M Kelly B, 2026-11-06 |
| No "Featured" tab on the public page | There is no featured flag | M Kelly B, 2026-11-06 |
| One Services filter, grouped by category | One filter instead of two | M Kelly B, 2026-11-06 |
| Starter catalog saves categories only when there are 2 or more | A one-kind business stays flat; a draft never fails on categories | M Kelly B, 2026-11-06 |
| One grouping helper in `lib/` and all words written in C2 | Four parts group services; features can't import each other, and parallel builders must not edit the same files | M Kelly B, 2026-11-06 |
| The Suggest panel's category is C3's, C6 stays server side | The panel lives in the Services screen file C3 owns | M Kelly B, 2026-11-06 |
| The migration's `ADD category_id` line carries `ON DELETE set null` by hand | drizzle-kit 0.31 leaves it out of SQLite ADD COLUMN although the snapshot has it; removal also clears the services itself | M Kelly B, 2026-11-06 |
