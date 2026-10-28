import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import type { PageLanguage } from "@/lib/page-language"

// The login form's words. The page passes its language: the owner area's on
// the login page, English on the home page.
const en = {
  logIn: "Log in",
  or: "or",
  email: "Email",
  useAnotherEmail: "Use another email",
  yourName: "Your name",
  choosePassword: "Choose a password",
  password: "Password",
  continue: "Continue",
  createAccount: "Create account",
  google: "Continue with Google",
  errors: {
    email: "Check your email address",
    name: "Add your name",
    password: `Use at least ${ONBOARDING_RULES.minPasswordLength} characters`,
    signUp: "That did not work. Please try again.",
    wrongPassword: "Wrong password",
  },
  googleErrors: {
    accountNotLinked:
      "You signed up with email and password. Log in that way below.",
    fallback: "Google sign-in didn't work. Try again.",
  },
}

export type AuthWords = typeof en

const es: AuthWords = {
  logIn: "Iniciar sesión",
  or: "o",
  email: "Correo",
  useAnotherEmail: "Usar otro correo",
  yourName: "Tu nombre",
  choosePassword: "Elige una contraseña",
  password: "Contraseña",
  continue: "Continuar",
  createAccount: "Crear cuenta",
  google: "Continuar con Google",
  errors: {
    email: "Revisa tu correo",
    name: "Escribe tu nombre",
    password: `Usa al menos ${ONBOARDING_RULES.minPasswordLength} caracteres`,
    signUp: "No funcionó. Inténtalo de nuevo.",
    wrongPassword: "Contraseña incorrecta",
  },
  googleErrors: {
    accountNotLinked:
      "Te registraste con correo y contraseña. Inicia sesión así abajo.",
    fallback: "No se pudo entrar con Google. Inténtalo de nuevo.",
  },
}

const WORDS: Record<PageLanguage, AuthWords> = { en, es }

export function authWordsFor(language: PageLanguage): AuthWords {
  return WORDS[language]
}
