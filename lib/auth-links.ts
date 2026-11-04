import { APP_START_URL } from "./app-install"
import type { PageLanguage } from "./page-language"

// Where the account screens are and how to link to them, in one place.
export const LOGIN_PATH = "/login"
export const RESET_PASSWORD_PATH = "/reset-password"
// Where an owner lands after logging in when nothing else was asked for.
export const AFTER_LOGIN_PATH = APP_START_URL

type AccountLink = {
  // Where to go after the screen.
  next?: string
  // The language the screen keeps, for a link from outside the owner area.
  language?: PageLanguage
}

function accountHref(path: string, { next, language }: AccountLink) {
  const params = new URLSearchParams()
  if (next) params.set("next", next)
  if (language) params.set("lang", language)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function loginHref(link: AccountLink = {}): string {
  return accountHref(LOGIN_PATH, link)
}

export function resetPasswordHref(link: AccountLink = {}): string {
  return accountHref(RESET_PASSWORD_PATH, link)
}
