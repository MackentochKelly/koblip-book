// Deleting an account's answer (owner Settings, client Settings, admin):
// "login" asks for a fresh login first; "owner" is a client account that
// still owns a business, deleted from the business's own settings.
export type DeleteResult =
  { ok: true } | { ok: false; error: "login" | "owner" | "failed" }
